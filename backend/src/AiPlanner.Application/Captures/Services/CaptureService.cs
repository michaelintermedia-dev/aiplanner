using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Ai.Services;
using AiPlanner.Application.Appointments.DTOs;
using AiPlanner.Application.Appointments.Interfaces;
using AiPlanner.Application.Captures.DTOs;
using AiPlanner.Application.Captures.Interfaces;
using AiPlanner.Application.Common.Exceptions;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Models;
using AiPlanner.Application.Common.Utils;
using AiPlanner.Application.Tasks.DTOs;
using AiPlanner.Application.Tasks.Interfaces;
using AiPlanner.Domain.Entities;
using AiPlanner.Domain.Enums;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AiPlanner.Application.Captures.Services;

public class CaptureService : ICaptureService
{
    private static readonly Dictionary<string, string> AudioExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        [".m4a"] = "audio/mp4",
        [".mp4"] = "audio/mp4",
        [".mp3"] = "audio/mpeg",
        [".mpeg"] = "audio/mpeg",
        [".mpga"] = "audio/mpeg",
        [".wav"] = "audio/wav",
        [".webm"] = "audio/webm",
        [".ogg"] = "audio/ogg",
        [".oga"] = "audio/ogg",
        [".flac"] = "audio/flac",
        [".aac"] = "audio/aac",
    };

    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTime _dateTime;
    private readonly ITranscriptionService _transcription;
    private readonly IIntentExtractionService _extraction;
    private readonly IFileStorageService _storage;
    private readonly ITaskService _tasks;
    private readonly IAppointmentService _appointments;
    private readonly IValidator<CreateTaskRequest> _taskValidator;
    private readonly IValidator<CreateAppointmentRequest> _appointmentValidator;
    private readonly ILogger<CaptureService> _logger;

    public CaptureService(
        IApplicationDbContext db,
        ICurrentUserService currentUser,
        IDateTime dateTime,
        ITranscriptionService transcription,
        IIntentExtractionService extraction,
        IFileStorageService storage,
        ITaskService tasks,
        IAppointmentService appointments,
        IValidator<CreateTaskRequest> taskValidator,
        IValidator<CreateAppointmentRequest> appointmentValidator,
        ILogger<CaptureService> logger)
    {
        _db = db;
        _currentUser = currentUser;
        _dateTime = dateTime;
        _transcription = transcription;
        _extraction = extraction;
        _storage = storage;
        _tasks = tasks;
        _appointments = appointments;
        _taskValidator = taskValidator;
        _appointmentValidator = appointmentValidator;
        _logger = logger;
    }

    public static bool IsSupportedAudioFile(string fileName) => AudioExtensions.ContainsKey(Path.GetExtension(fileName));

    public async Task<Result<CaptureDto>> CaptureTextAsync(CaptureTextRequest request, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var extraction = await ExtractAsync(userId, request.Text.Trim(), transcript: null, ct);
        return Result<CaptureDto>.Success(ToDto(extraction, transcript: null));
    }

    public async Task<Result<CaptureDto>> CaptureVoiceAsync(Stream audio, string fileName, string? mimeType, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        if (!AudioExtensions.TryGetValue(extension, out var defaultMime))
        {
            return Result<CaptureDto>.Failure($"Unsupported audio format '{extension}'.");
        }

        var voice = new VoiceCapture
        {
            UserId = userId,
            MimeType = string.IsNullOrWhiteSpace(mimeType) ? defaultMime : mimeType,
            Status = VoiceCaptureStatus.PendingUpload,
        };
        voice.AudioStorageKey = $"{userId:N}/{voice.Id:N}{extension}";

        await _storage.SaveAsync(voice.AudioStorageKey, audio, ct);
        voice.Status = VoiceCaptureStatus.Transcribing;
        _db.VoiceCaptures.Add(voice);
        await _db.SaveChangesAsync(ct);

        TranscriptionResult transcription;
        try
        {
            await using var stored = await _storage.OpenReadAsync(voice.AudioStorageKey, ct)
                ?? throw new InvalidOperationException("The recording was not found right after saving it.");
            transcription = await _transcription.TranscribeAsync(stored, Path.GetFileName(voice.AudioStorageKey), voice.MimeType, ct);
        }
        catch (AiProviderException ex)
        {
            await MarkFailedAsync(voice, $"Transcription failed: {ex.Message}", ct);
            throw;
        }

        var text = transcription.Text.Trim();
        if (text.Length == 0)
        {
            await MarkFailedAsync(voice, "No speech detected.", ct);
            return Result<CaptureDto>.Failure("No speech was detected in the recording.");
        }

        var transcript = new Transcript
        {
            UserId = userId,
            VoiceCaptureId = voice.Id,
            Text = text,
            LanguageCode = transcription.LanguageCode,
            ProviderName = transcription.ProviderName,
        };
        // Add explicitly: entities get their Guid key in the constructor, so EF would
        // treat one merely attached via a navigation as an existing row (UPDATE).
        _db.Transcripts.Add(transcript);
        voice.Transcript = transcript;
        voice.Status = VoiceCaptureStatus.Analyzing;
        await _db.SaveChangesAsync(ct);

        AIExtraction extraction;
        try
        {
            extraction = await ExtractAsync(userId, text, transcript, ct);
        }
        catch (AiProviderException ex)
        {
            // The transcript is kept, so the user doesn't lose what they said.
            await MarkFailedAsync(voice, $"Analysis failed: {ex.Message}", ct);
            throw;
        }

        voice.Status = VoiceCaptureStatus.Analyzed;
        await _db.SaveChangesAsync(ct);
        return Result<CaptureDto>.Success(ToDto(extraction, transcript));
    }

    public async Task<IReadOnlyList<CaptureSummaryDto>> GetListAsync(int take, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        return await _db.AIExtractions
            .AsNoTracking()
            .Where(e => e.UserId == userId)
            .OrderByDescending(e => e.CreatedAtUtc)
            .Take(Math.Clamp(take, 1, 100))
            .Select(e => new CaptureSummaryDto(
                e.Id,
                e.TranscriptId == null ? "Text" : "Voice",
                e.Title ?? "Capture",
                e.Summary,
                e.CreatedAtUtc,
                e.Items.Count,
                e.Items.Count(i => i.Status == ExtractionStatus.PendingReview)))
            .ToListAsync(ct);
    }

    public async Task<Result<CaptureDto>> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var extraction = await FindOwnedAsync(id, track: false, ct);
        return extraction is null
            ? Result<CaptureDto>.Failure("Capture not found.")
            : Result<CaptureDto>.Success(ToDto(extraction, extraction.Transcript));
    }

    public async Task<Result<CaptureDto>> ConfirmAsync(Guid id, ConfirmCaptureRequest request, CancellationToken ct = default)
    {
        var extraction = await FindOwnedAsync(id, track: true, ct);
        if (extraction is null)
        {
            return Result<CaptureDto>.Failure("Capture not found.");
        }

        var itemsById = extraction.Items.ToDictionary(i => i.Id);
        var unknown = request.Items.Where(i => !itemsById.ContainsKey(i.Id)).Select(i => i.Id).ToList();
        if (unknown.Count > 0)
        {
            return Result<CaptureDto>.Failure($"Unknown item(s): {string.Join(", ", unknown)}.");
        }
        var alreadyDecided = request.Items.Where(i => itemsById[i.Id].Status != ExtractionStatus.PendingReview).ToList();
        if (alreadyDecided.Count > 0)
        {
            // Confirming twice must never create duplicates.
            return Result<CaptureDto>.Failure("Some items were already saved or rejected. Reload the capture.");
        }

        var errors = await ValidateAsync(request.Items.Where(i => i.Include), ct);
        if (errors.Count > 0)
        {
            return Result<CaptureDto>.Failure(errors.ToArray());
        }

        try
        {
            await _db.ExecuteInTransactionAsync(async innerCt =>
            {
                foreach (var decision in request.Items)
                {
                    var item = itemsById[decision.Id];
                    if (!decision.Include)
                    {
                        item.Status = ExtractionStatus.Rejected;
                        continue;
                    }

                    var failure = await SaveItemAsync(extraction, item, decision, innerCt);
                    if (failure is not null)
                    {
                        // Throwing rolls back everything created so far in this confirm.
                        throw new CaptureConfirmException(failure);
                    }
                    item.Status = IsEdited(item, decision) ? ExtractionStatus.Edited : ExtractionStatus.Accepted;
                    ApplyDecision(item, decision);
                }
                await _db.SaveChangesAsync(innerCt);
                return true;
            }, ct);
        }
        catch (CaptureConfirmException ex)
        {
            return Result<CaptureDto>.Failure(ex.Message);
        }

        _logger.LogInformation(
            "Capture {CaptureId} confirmed: {Accepted} saved, {Rejected} rejected",
            extraction.Id,
            request.Items.Count(i => i.Include),
            request.Items.Count(i => !i.Include));

        return Result<CaptureDto>.Success(ToDto(extraction, extraction.Transcript));
    }

    public async Task<Result<(Stream Content, string MimeType)>> OpenAudioAsync(Guid id, CancellationToken ct = default)
    {
        var extraction = await FindOwnedAsync(id, track: false, ct);
        var voice = extraction?.Transcript?.VoiceCapture;
        if (voice?.AudioStorageKey is null)
        {
            return Result<(Stream, string)>.Failure("No recording for this capture.");
        }

        var stream = await _storage.OpenReadAsync(voice.AudioStorageKey, ct);
        return stream is null
            ? Result<(Stream, string)>.Failure("No recording for this capture.")
            : Result<(Stream, string)>.Success((stream, voice.MimeType ?? "application/octet-stream"));
    }

    public async Task<Result> DeleteAudioAsync(Guid id, CancellationToken ct = default)
    {
        var extraction = await FindOwnedAsync(id, track: true, ct);
        var voice = extraction?.Transcript?.VoiceCapture;
        if (voice?.AudioStorageKey is null)
        {
            return Result.Failure("No recording for this capture.");
        }

        await _storage.DeleteAsync(voice.AudioStorageKey, ct);
        voice.AudioStorageKey = null;
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }

    // ---- Extraction --------------------------------------------------------

    private async Task<AIExtraction> ExtractAsync(Guid userId, string text, Transcript? transcript, CancellationToken ct)
    {
        var user = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.TimeZoneId, u.Locale })
            .SingleAsync(ct);

        var timeZone = UserTimeZoneHelper.ResolveTimeZone(user.TimeZoneId);
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(_dateTime.UtcNow, timeZone);

        var started = _dateTime.UtcNow;
        var raw = await _extraction.ExtractAsync(new ExtractionContext(text, localNow, timeZone.Id, user.Locale), ct);
        var normalized = ExtractionNormalizer.Normalize(raw, text, localNow, timeZone);

        // Log counts and timing only - never the user's words (spec section 37).
        _logger.LogInformation(
            "Extracted {ItemCount} item(s) ({RawCount} proposed) with {Model} in {ElapsedMs} ms",
            normalized.Items.Count, raw.Items.Count, raw.ModelName, (_dateTime.UtcNow - started).TotalMilliseconds);

        var extraction = new AIExtraction
        {
            UserId = userId,
            TranscriptId = transcript?.Id,
            Transcript = transcript,
            RawInputText = transcript is null ? text : null,
            RawResponseJson = raw.RawResponseJson,
            ProviderName = raw.ProviderName,
            ModelName = raw.ModelName,
            ProcessedAtUtc = _dateTime.UtcNow,
            Title = normalized.Title,
            Summary = normalized.Summary,
            Items = normalized.Items.Select(i => new AIExtractionItem
            {
                UserId = userId,
                Intent = i.Intent,
                Status = ExtractionStatus.PendingReview,
                Title = i.Title,
                Summary = i.Summary,
                Description = i.Description,
                StartDateUtc = i.StartUtc,
                EndDateUtc = i.EndUtc,
                DueDateUtc = i.DueUtc,
                HasTime = i.HasTime,
                Location = i.Location,
                Priority = i.Priority,
                ReminderMinutesBefore = i.ReminderMinutesBefore,
                RecurrenceFrequency = i.Recurrence,
                Clarification = i.Clarification,
                Confidence = i.Confidence,
            }).ToList(),
        };

        _db.AIExtractions.Add(extraction);
        await _db.SaveChangesAsync(ct);
        return extraction;
    }

    // ---- Confirm -----------------------------------------------------------

    private async Task<List<string>> ValidateAsync(IEnumerable<ConfirmCaptureItem> included, CancellationToken ct)
    {
        var errors = new List<string>();
        foreach (var item in included)
        {
            var result = item.Intent switch
            {
                ExtractionIntent.Appointment => await _appointmentValidator.ValidateAsync(ToAppointmentRequest(item), ct),
                ExtractionIntent.Task or ExtractionIntent.Reminder => await _taskValidator.ValidateAsync(ToTaskRequest(item), ct),
                _ => null,
            };
            if (result is { IsValid: false })
            {
                errors.AddRange(result.Errors.Select(e => $"\"{item.Title}\": {e.ErrorMessage}"));
            }
        }
        return errors;
    }

    /// <summary>Creates the real item; returns an error message instead of throwing for expected failures.</summary>
    private async Task<string?> SaveItemAsync(AIExtraction extraction, AIExtractionItem item, ConfirmCaptureItem decision, CancellationToken ct)
    {
        switch (decision.Intent)
        {
            case ExtractionIntent.Appointment:
            {
                var created = await _appointments.CreateAsync(ToAppointmentRequest(decision), ct);
                if (!created.Succeeded) return string.Join(" ", created.Errors);
                var appointment = await _db.Appointments.FindAsync([created.Value!.Id], ct);
                appointment!.SourceAiExtractionId = extraction.Id;
                item.ResultingAppointmentId = appointment.Id;
                return null;
            }
            case ExtractionIntent.Note:
            {
                var note = new Note
                {
                    UserId = extraction.UserId,
                    Title = decision.Title.Trim(),
                    Content = string.IsNullOrWhiteSpace(decision.Description) ? decision.Title.Trim() : decision.Description,
                    SourceAiExtractionId = extraction.Id,
                };
                _db.Notes.Add(note);
                item.ResultingNoteId = note.Id;
                return null;
            }
            default:
            {
                var created = await _tasks.CreateAsync(ToTaskRequest(decision), ct);
                if (!created.Succeeded) return string.Join(" ", created.Errors);
                var task = await _db.TaskItems.FindAsync([created.Value!.Id], ct);
                task!.SourceAiExtractionId = extraction.Id;
                item.ResultingTaskItemId = task.Id;
                return null;
            }
        }
    }

    private static CreateTaskRequest ToTaskRequest(ConfirmCaptureItem i) => new(
        Title: i.Title.Trim(),
        Description: i.Description,
        Notes: null,
        StartDateUtc: null,
        DueDateUtc: i.DueUtc,
        HasDueTime: i.DueUtc is not null && i.HasTime,
        Priority: i.Priority ?? TaskPriority.None,
        IsOngoing: false,
        // A reminder is a task with a reminder at its due time.
        ReminderMinutesBeforeDue: i.DueUtc is null ? null : i.Intent == ExtractionIntent.Reminder ? i.ReminderMinutesBefore ?? 0 : i.ReminderMinutesBefore,
        Tags: null);

    private static CreateAppointmentRequest ToAppointmentRequest(ConfirmCaptureItem i) => new(
        Title: i.Title.Trim(),
        Description: i.Description,
        Notes: null,
        StartUtc: i.StartUtc ?? default,
        EndUtc: i.EndUtc ?? default,
        Location: i.Location,
        ParticipantNames: null,
        ReminderMinutesBeforeStart: i.ReminderMinutesBefore);

    private static bool IsEdited(AIExtractionItem item, ConfirmCaptureItem d) =>
        item.Intent != d.Intent
        || item.Title != d.Title.Trim()
        || item.Description != d.Description
        || item.StartDateUtc != d.StartUtc
        || item.EndDateUtc != d.EndUtc
        || item.DueDateUtc != d.DueUtc
        || item.HasTime != d.HasTime
        || item.Location != d.Location
        || item.Priority != d.Priority
        || item.ReminderMinutesBefore != d.ReminderMinutesBefore;

    /// <summary>Keeps the stored item in sync with what was actually saved.</summary>
    private static void ApplyDecision(AIExtractionItem item, ConfirmCaptureItem d)
    {
        item.Intent = d.Intent;
        item.Title = d.Title.Trim();
        item.Description = d.Description;
        item.StartDateUtc = d.StartUtc;
        item.EndDateUtc = d.EndUtc;
        item.DueDateUtc = d.DueUtc;
        item.HasTime = d.HasTime;
        item.Location = d.Location;
        item.Priority = d.Priority;
        item.ReminderMinutesBefore = d.ReminderMinutesBefore;
    }

    // ---- Helpers -----------------------------------------------------------

    private async Task MarkFailedAsync(VoiceCapture voice, string reason, CancellationToken ct)
    {
        voice.Status = VoiceCaptureStatus.Failed;
        voice.FailureReason = reason.Length > 1000 ? reason[..1000] : reason;
        await _db.SaveChangesAsync(ct);
    }

    private async Task<AIExtraction?> FindOwnedAsync(Guid id, bool track, CancellationToken ct)
    {
        var userId = RequireUserId();
        var query = _db.AIExtractions
            .Include(e => e.Items)
            .Include(e => e.Transcript).ThenInclude(t => t!.VoiceCapture)
            .Where(e => e.Id == id && e.UserId == userId);
        return await (track ? query : query.AsNoTracking()).SingleOrDefaultAsync(ct);
    }

    private Guid RequireUserId() =>
        _currentUser.UserId ?? throw new UnauthorizedAccessException("No authenticated user.");

    private static CaptureDto ToDto(AIExtraction e, Transcript? transcript) => new(
        e.Id,
        transcript is null ? "Text" : "Voice",
        e.Title ?? "Capture",
        e.Summary,
        transcript?.Text ?? e.RawInputText ?? string.Empty,
        transcript?.LanguageCode,
        transcript?.VoiceCapture?.AudioStorageKey is not null,
        e.CreatedAtUtc,
        e.Items
            .OrderBy(i => i.StartDateUtc ?? i.DueDateUtc ?? DateTime.MaxValue)
            .Select(i => new CaptureItemDto(
                i.Id, i.Intent, i.Status, i.Title, i.Summary, i.Description,
                i.StartDateUtc, i.EndDateUtc, i.DueDateUtc, i.HasTime, i.Location,
                i.Priority, i.ReminderMinutesBefore, i.RecurrenceFrequency,
                i.Clarification, i.Confidence,
                i.ResultingTaskItemId, i.ResultingAppointmentId, i.ResultingNoteId))
            .ToList());

    /// <summary>Aborts a confirm transaction with a message for the user.</summary>
    private sealed class CaptureConfirmException(string message) : Exception(message);
}
