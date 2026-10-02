using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Ai.Services;
using AiPlanner.Application.Appointments.DTOs;
using AiPlanner.Application.Appointments.Interfaces;
using AiPlanner.Application.Captures.DTOs;
using AiPlanner.Application.Captures.Interfaces;
using AiPlanner.Application.Common.Exceptions;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Models;
using AiPlanner.Application.Reminders;
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
    private readonly ReminderPlanner _reminders;

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
        ReminderPlanner reminders,
        ILogger<CaptureService> logger)
    {
        _reminders = reminders;
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

    public const int MaxSegments = 20;

    public static bool IsSupportedAudioFile(string fileName) => AudioExtensions.ContainsKey(Path.GetExtension(fileName));

    public async Task<Result<CaptureDto>> CaptureTextAsync(CaptureTextRequest request, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var extraction = await ExtractAsync(userId, request.Text.Trim(), transcript: null, ct);
        return Result<CaptureDto>.Success(ToDto(extraction, transcript: null));
    }

    public async Task<Result<CaptureDto>> CaptureVoiceAsync(IReadOnlyList<AudioSegment> segments, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        if (segments.Count == 0)
        {
            return Result<CaptureDto>.Failure("No audio was uploaded.");
        }
        if (segments.Count > MaxSegments)
        {
            return Result<CaptureDto>.Failure($"Too many parts (max {MaxSegments}).");
        }

        var extensions = segments.Select(s => Path.GetExtension(s.FileName).ToLowerInvariant()).ToList();
        if (extensions.FirstOrDefault(e => !AudioExtensions.ContainsKey(e)) is { } unsupported)
        {
            return Result<CaptureDto>.Failure($"Unsupported audio format '{unsupported}'.");
        }

        var voice = new VoiceCapture
        {
            UserId = userId,
            MimeType = string.IsNullOrWhiteSpace(segments[0].MimeType) ? AudioExtensions[extensions[0]] : segments[0].MimeType,
            Status = VoiceCaptureStatus.PendingUpload,
        };
        for (var i = 0; i < segments.Count; i++)
        {
            var key = segments.Count == 1
                ? $"{userId:N}/{voice.Id:N}{extensions[i]}"
                : $"{userId:N}/{voice.Id:N}-{i + 1:D2}{extensions[i]}";
            await _storage.SaveAsync(key, segments[i].Content, ct);
            voice.AudioStorageKeys.Add(key);
        }
        voice.Status = VoiceCaptureStatus.Transcribing;
        _db.VoiceCaptures.Add(voice);
        await _db.SaveChangesAsync(ct);

        TranscriptionResult[] parts;
        try
        {
            // Segments are independent files: transcribe them in parallel, then
            // join the text in speaking order.
            parts = await Task.WhenAll(voice.AudioStorageKeys.Select(async (key, i) =>
            {
                await using var stored = await _storage.OpenReadAsync(key, ct)
                    ?? throw new InvalidOperationException("The recording was not found right after saving it.");
                var mime = string.IsNullOrWhiteSpace(segments[i].MimeType) ? AudioExtensions[extensions[i]] : segments[i].MimeType;
                return await _transcription.TranscribeAsync(stored, Path.GetFileName(key), mime, ct);
            }));
        }
        catch (AiProviderException ex)
        {
            await MarkFailedAsync(voice, $"Transcription failed: {ex.Message}", ct);
            throw;
        }

        var transcription = new TranscriptionResult(
            string.Join(" ", parts.Select(p => p.Text.Trim()).Where(t => t.Length > 0)),
            parts.Select(p => p.LanguageCode).FirstOrDefault(l => l is not null),
            parts[0].ProviderName);

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

        var errors = await ValidateAsync(request.Items.Where(i => i.Include && i.AppendToId is null), ct);
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

    public async Task<Result<(Stream Content, string MimeType)>> OpenAudioAsync(Guid id, int part = 0, CancellationToken ct = default)
    {
        var extraction = await FindOwnedAsync(id, track: false, ct);
        var keys = extraction?.Transcript?.VoiceCapture?.AudioStorageKeys;
        if (keys is null || part < 0 || part >= keys.Count)
        {
            return Result<(Stream, string)>.Failure("No recording for this capture.");
        }

        var stream = await _storage.OpenReadAsync(keys[part], ct);
        var mime = AudioExtensions.GetValueOrDefault(Path.GetExtension(keys[part]), "application/octet-stream");
        return stream is null
            ? Result<(Stream, string)>.Failure("No recording for this capture.")
            : Result<(Stream, string)>.Success((stream, mime));
    }

    public async Task<Result> DeleteAudioAsync(Guid id, CancellationToken ct = default)
    {
        var extraction = await FindOwnedAsync(id, track: true, ct);
        var voice = extraction?.Transcript?.VoiceCapture;
        if (voice is null || voice.AudioStorageKeys.Count == 0)
        {
            return Result.Failure("No recording for this capture.");
        }

        foreach (var key in voice.AudioStorageKeys)
        {
            await _storage.DeleteAsync(key, ct);
        }
        // Assign a new list (not Clear) so EF sees the JSON column change.
        voice.AudioStorageKeys = [];
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }

    // ---- Extraction --------------------------------------------------------

    private async Task<AIExtraction> ExtractAsync(Guid userId, string text, Transcript? transcript, CancellationToken ct)
    {
        var (raw, normalized) = await ProposeAsync(userId, text, previousText: null, currentItem: null, ct);

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
            Items = normalized.Items.Select(i => ToItem(userId, i)).ToList(),
        };

        _db.AIExtractions.Add(extraction);
        await _db.SaveChangesAsync(ct);
        return extraction;
    }

    /// <summary>Asks the AI about <paramref name="text"/> and validates the answer.</summary>
    private async Task<(RawExtraction Raw, NormalizedExtraction Normalized)> ProposeAsync(
        Guid userId, string text, string? previousText, string? currentItem, CancellationToken ct)
    {
        var user = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.TimeZoneId, u.Locale })
            .SingleAsync(ct);

        var timeZone = UserTimeZoneHelper.ResolveTimeZone(user.TimeZoneId);
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(_dateTime.UtcNow, timeZone);

        var started = _dateTime.UtcNow;
        var raw = await _extraction.ExtractAsync(
            new ExtractionContext(text, localNow, timeZone.Id, user.Locale, previousText, currentItem), ct);
        var normalized = ExtractionNormalizer.Normalize(raw, text, localNow, timeZone);

        // Log counts and timing only - never the user's words (spec section 37).
        _logger.LogInformation(
            "Extracted {ItemCount} item(s) ({RawCount} proposed) with {Model} in {ElapsedMs} ms",
            normalized.Items.Count, raw.Items.Count, raw.ModelName, (_dateTime.UtcNow - started).TotalMilliseconds);
        return (raw, normalized);
    }

    private static AIExtractionItem ToItem(Guid userId, NormalizedItem i) => new()
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
        RecurrenceFrequency = i.Recurrence,
        Clarification = i.Clarification,
        Confidence = i.Confidence,
        AddsToCurrent = i.AddsToCurrent,
        ProposedReminders = ReminderPlanner.ToProposed(i.Reminders),
    };

    // ---- Continue ----------------------------------------------------------

    public async Task<Result<CaptureDto>> ContinueAsync(Guid id, ContinueCaptureRequest request, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var extraction = await FindOwnedAsync(id, track: true, ct);
        if (extraction is null)
        {
            return Result<CaptureDto>.Failure("Capture not found.");
        }
        var typed = string.IsNullOrWhiteSpace(request.Text) ? null : request.Text.Trim();
        if (typed is null && request.Audio.Count == 0)
        {
            return Result<CaptureDto>.Failure("Say or type something to add.");
        }
        if (request.Audio.Count > MaxSegments)
        {
            return Result<CaptureDto>.Failure($"Too many parts (max {MaxSegments}).");
        }
        var extensions = request.Audio.Select(s => Path.GetExtension(s.FileName).ToLowerInvariant()).ToList();
        if (extensions.FirstOrDefault(e => !AudioExtensions.ContainsKey(e)) is { } unsupported)
        {
            return Result<CaptureDto>.Failure($"Unsupported audio format '{unsupported}'.");
        }

        // The saved item the user continues from - context for the AI.
        string? currentItem = request.ItemId is not { } itemId ? null : request.ItemType switch
        {
            "Task" => await _db.TaskItems.Where(t => t.Id == itemId && t.UserId == userId).Select(t => t.Title).FirstOrDefaultAsync(ct),
            "Appointment" => await _db.Appointments.Where(a => a.Id == itemId && a.UserId == userId).Select(a => a.Title).FirstOrDefaultAsync(ct),
            "Note" => await _db.Notes.Where(n => n.Id == itemId && n.UserId == userId).Select(n => n.Title ?? n.Content).FirstOrDefaultAsync(ct),
            _ => null,
        };

        var previousText = extraction.Transcript?.Text ?? extraction.RawInputText ?? "";
        var added = new List<string>();

        if (request.Audio.Count > 0)
        {
            var voice = extraction.Transcript?.VoiceCapture;
            var keys = new List<string>();
            for (var i = 0; i < request.Audio.Count; i++)
            {
                // A unique suffix per added part; the original parts keep their names.
                var key = $"{userId:N}/{(voice?.Id ?? extraction.Id):N}-c{Guid.NewGuid().ToString("N")[..8]}{extensions[i]}";
                await _storage.SaveAsync(key, request.Audio[i].Content, ct);
                keys.Add(key);
            }

            var parts = await Task.WhenAll(keys.Select(async (key, i) =>
            {
                await using var stored = await _storage.OpenReadAsync(key, ct)
                    ?? throw new InvalidOperationException("The recording was not found right after saving it.");
                var mime = string.IsNullOrWhiteSpace(request.Audio[i].MimeType) ? AudioExtensions[extensions[i]] : request.Audio[i].MimeType;
                return await _transcription.TranscribeAsync(stored, Path.GetFileName(key), mime!, ct);
            }));
            var spoken = string.Join(" ", parts.Select(p => p.Text.Trim()).Where(t => t.Length > 0));

            if (voice is not null)
            {
                // Assign a new list (not Add) so EF sees the JSON column change.
                voice.AudioStorageKeys = [.. voice.AudioStorageKeys, .. keys];
            }
            else
            {
                // A typed capture has no recording to extend: keep the words only.
                foreach (var key in keys) await _storage.DeleteAsync(key, ct);
            }
            if (spoken.Length > 0) added.Add(spoken);
        }
        if (typed is not null) added.Add(typed);

        var newText = string.Join(" ", added);
        if (newText.Length == 0)
        {
            await _db.SaveChangesAsync(ct); // keep the recording even if it was silent
            return Result<CaptureDto>.Failure("No speech was detected in the recording.");
        }

        if (extraction.Transcript is { } transcript)
        {
            transcript.Text = $"{transcript.Text.TrimEnd()}\n\n{newText}";
        }
        else
        {
            extraction.RawInputText = $"{extraction.RawInputText?.TrimEnd()}\n\n{newText}".TrimStart();
        }
        await _db.SaveChangesAsync(ct); // the words are kept even if the AI fails next

        var (_, normalized) = await ProposeAsync(userId, newText, previousText, currentItem, ct);
        foreach (var proposed in normalized.Items)
        {
            var item = ToItem(userId, proposed);
            item.AiExtractionId = extraction.Id;
            // Explicit Add (attached only via the navigation, EF would UPDATE the pre-keyed
            // row); EF's fix-up then puts it in extraction.Items.
            _db.AIExtractionItems.Add(item);
        }
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Capture {CaptureId} continued: {Parts} audio part(s), {Items} new item(s)",
            extraction.Id, request.Audio.Count, normalized.Items.Count);
        return Result<CaptureDto>.Success(ToDto(extraction, extraction.Transcript));
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
        if (decision.AppendToId is { } targetId)
        {
            return await AppendToItemAsync(extraction.UserId, item, decision.AppendToType!, targetId, decision, ct);
        }

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
                _reminders.Set(note.Reminders, decision.Reminders, itemTimeUtc: null,
                    await _reminders.ZoneAsync(extraction.UserId, ct), extraction.UserId, r => r.NoteId = note.Id);
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

    /// <summary>"Add to this item": the reviewed text goes into the existing item's details.</summary>
    private async Task<string?> AppendToItemAsync(
        Guid userId, AIExtractionItem item, string type, Guid targetId, ConfirmCaptureItem decision, CancellationToken ct)
    {
        var addition = (string.IsNullOrWhiteSpace(decision.Description) ? decision.Title : decision.Description).Trim();
        static string Join(string? existing, string addition) =>
            string.IsNullOrWhiteSpace(existing) ? addition : $"{existing.TrimEnd()}\n\n{addition}";

        switch (type)
        {
            case "Task":
                var task = await _db.TaskItems.FirstOrDefaultAsync(t => t.Id == targetId && t.UserId == userId, ct);
                if (task is null) return "The task to add to was not found.";
                task.Description = Join(task.Description, addition);
                item.ResultingTaskItemId = task.Id;
                return null;
            case "Appointment":
                var appointment = await _db.Appointments.FirstOrDefaultAsync(a => a.Id == targetId && a.UserId == userId, ct);
                if (appointment is null) return "The event to add to was not found.";
                appointment.Description = Join(appointment.Description, addition);
                item.ResultingAppointmentId = appointment.Id;
                return null;
            default:
                var note = await _db.Notes.FirstOrDefaultAsync(n => n.Id == targetId && n.UserId == userId, ct);
                if (note is null) return "The note to add to was not found.";
                note.Content = Join(note.Content, addition);
                item.ResultingNoteId = note.Id;
                return null;
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
        // Legacy "reminder" items are tasks that remind at their time.
        Reminders: i.Reminders is { Count: > 0 } given
            ? given
            : i.Intent == ExtractionIntent.Reminder ? [new ReminderDto(ReminderKind.Before, MinutesBefore: 0)] : null,
        Tags: null);

    private static CreateAppointmentRequest ToAppointmentRequest(ConfirmCaptureItem i) => new(
        Title: i.Title.Trim(),
        Description: i.Description,
        Notes: null,
        StartUtc: i.StartUtc ?? default,
        EndUtc: i.EndUtc ?? default,
        Location: i.Location,
        ParticipantNames: null,
        Reminders: i.Reminders);

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
        || !ReminderPlanner.SameList(ReminderPlanner.FromProposed(item.ProposedReminders), d.Reminders);

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
        item.ProposedReminders = ReminderPlanner.ToProposed(d.Reminders);
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
        transcript?.VoiceCapture?.AudioStorageKeys.Count ?? 0,
        e.CreatedAtUtc,
        e.Items
            .OrderBy(i => i.StartDateUtc ?? i.DueDateUtc ?? DateTime.MaxValue)
            .Select(i => new CaptureItemDto(
                i.Id, i.Intent, i.Status, i.Title, i.Summary, i.Description,
                i.StartDateUtc, i.EndDateUtc, i.DueDateUtc, i.HasTime, i.Location,
                i.Priority, ReminderPlanner.FromProposed(i.ProposedReminders), i.RecurrenceFrequency,
                i.Clarification, i.Confidence,
                i.ResultingTaskItemId, i.ResultingAppointmentId, i.ResultingNoteId, i.AddsToCurrent))
            .ToList());

    /// <summary>Aborts a confirm transaction with a message for the user.</summary>
    private sealed class CaptureConfirmException(string message) : Exception(message);
}
