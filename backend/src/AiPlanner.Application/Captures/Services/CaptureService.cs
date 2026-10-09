using AiPlanner.Application.Recurrence;
using System.Text.Json;
using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Ai.Services;
using AiPlanner.Application.Appointments.DTOs;
using AiPlanner.Application.Appointments.Interfaces;
using AiPlanner.Application.Captures.DTOs;
using AiPlanner.Application.Captures.Interfaces;
using AiPlanner.Application.Common.Exceptions;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Models;
using AiPlanner.Application.Items.DTOs;
using AiPlanner.Application.Items.Interfaces;
using AiPlanner.Application.Notes.DTOs;
using AiPlanner.Application.Notes.Interfaces;
using AiPlanner.Application.Reminders;
using AiPlanner.Application.Tags;
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
    private readonly INoteService _notes;
    private readonly IAudioCompressor _compressor;
    private readonly IItemConversionService _conversion;
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
        INoteService notes,
        IAudioCompressor compressor,
        IItemConversionService conversion,
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
        _notes = notes;
        _compressor = compressor;
        _conversion = conversion;
        _taskValidator = taskValidator;
        _appointmentValidator = appointmentValidator;
        _logger = logger;
    }

    public const int MaxSegments = 20;

    public static bool IsSupportedAudioFile(string fileName) => AudioExtensions.ContainsKey(Path.GetExtension(fileName));

    public async Task<Result<CaptureDto>> CaptureTextAsync(CaptureTextRequest request, CancellationToken ct = default, IReadOnlyList<MediaUpload>? media = null)
    {
        var userId = RequireUserId();
        var words = request.Text?.Trim() ?? "";
        var read = await ReadMediaAsync(userId, media, ct);
        if (words.Length == 0 && read.Count == 0)
        {
            return Result<CaptureDto>.Failure(media is { Count: > 0 } ? "Add a few words - the AI doesn't read these files." : "Text is required.");
        }
        // Only a photo: the capture is known by its file names; the AI makes the title from what it shows.
        var input = words.Length > 0 ? words : string.Join(", ", media!.Select(m => m.FileName));
        var (extraction, search) = await ExtractAsync(userId, input, transcript: null, ct, read, wordsGiven: words.Length > 0);
        return Result<CaptureDto>.Success((await SaveNowAsync(extraction, transcript: null, request.SaveNow, ct)) with { Search = search });
    }

    /// <summary>
    /// The attached files the AI can read (see MediaReader) - only if the user
    /// agreed to them going to OpenAI (Settings, asked once); counts only in the log.
    /// </summary>
    private async Task<IReadOnlyList<MediaInput>> ReadMediaAsync(Guid userId, IReadOnlyList<MediaUpload>? media, CancellationToken ct)
    {
        if (media is not { Count: > 0 }) return [];
        if ((await SettingsAsync(userId, ct)).AiReadsMedia != true) return [];
        var (read, skipped) = MediaReader.Prepare(media.Select(m => (m.FileName, m.Data)));
        _logger.LogInformation("Capture media: {Read} read, {Skipped} not readable", read.Count, skipped.Count);
        return read;
    }

    public async Task<Result<CaptureDto>> CaptureVoiceAsync(IReadOnlyList<AudioSegment> segments, CancellationToken ct = default, bool saveNow = false, IReadOnlyList<MediaUpload>? media = null)
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
        // Transcribed: now keep it small (WAV -> compressed).
        voice.AudioStorageKeys = await CompressAsync(voice.AudioStorageKeys, ct);

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
        FeedSearch? search;
        try
        {
            (extraction, search) = await ExtractAsync(userId, text, transcript, ct, await ReadMediaAsync(userId, media, ct));
        }
        catch (AiProviderException ex)
        {
            // The transcript is kept, so the user doesn't lose what they said.
            await MarkFailedAsync(voice, $"Analysis failed: {ex.Message}", ct);
            throw;
        }

        voice.Status = VoiceCaptureStatus.Analyzed;
        await _db.SaveChangesAsync(ct);
        return Result<CaptureDto>.Success((await SaveNowAsync(extraction, transcript, saveNow, ct)) with { Search = search });
    }

    public async Task<IReadOnlyList<CaptureSummaryDto>> GetListAsync(int take, CancellationToken ct = default, int? pendingDays = null)
    {
        var userId = RequireUserId();
        var query = _db.AIExtractions.AsNoTracking().Where(e => e.UserId == userId);
        if (pendingDays is { } days)
        {
            var since = _dateTime.UtcNow.AddDays(-Math.Clamp(days, 1, 365));
            query = query.Where(e => e.CreatedAtUtc >= since && e.Items.Any(i => i.Status == ExtractionStatus.PendingReview && !i.HeldByEditForm));
        }
        return await query
            .OrderByDescending(e => e.CreatedAtUtc)
            .Take(Math.Clamp(take, 1, 100))
            .Select(e => new CaptureSummaryDto(
                e.Id,
                e.TranscriptId == null ? "Text" : "Voice",
                e.Title ?? "Capture",
                e.Summary,
                e.CreatedAtUtc,
                e.Items.Count,
                e.Items.Count(i => i.Status == ExtractionStatus.PendingReview && !i.HeldByEditForm)))
            .ToListAsync(ct);
    }

    public async Task<int> DiscardPendingAsync(CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var pending = await _db.AIExtractionItems
            .Where(i => i.UserId == userId && i.Status == ExtractionStatus.PendingReview && !i.HeldByEditForm)
            .ToListAsync(ct);
        foreach (var item in pending) item.Status = ExtractionStatus.Rejected;
        await _db.SaveChangesAsync(ct);
        return pending.Count;
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
        // Linking an Edit form's proposal that was already decided is a no-op (the
        // form's fields were saved on their own) - never a reason to fail Save.
        request = request with
        {
            Items = request.Items.Where(i => !(i.LinkOnly && itemsById[i.Id].Status != ExtractionStatus.PendingReview)).ToList(),
        };
        if (request.Items.Count == 0)
        {
            return Result<CaptureDto>.Success(ToDto(extraction, extraction.Transcript));
        }
        var alreadyDecided = request.Items.Where(i => itemsById[i.Id].Status != ExtractionStatus.PendingReview).ToList();
        if (alreadyDecided.Count > 0)
        {
            // Confirming twice must never create duplicates.
            return Result<CaptureDto>.Failure("Some items were already saved or rejected. Reload the capture.");
        }

        var errors = await ValidateAsync(request.Items.Where(i => i.Include && !i.LinkOnly && (i.AppendToId is null || i.ReplacesItem)), ct);
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
                        if (item.HeldByEditForm) await TakeBackAsync(extraction, item, innerCt);
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

        // "Keep the recording" unticked: the words stay, the audio goes.
        // Only when something was saved - Cancel (all rejected) leaves it to RecordingCleanup.
        if (!request.KeepRecording && request.Items.Any(i => i.Include) && extraction.Transcript?.VoiceCapture is { AudioStorageKeys.Count: > 0 })
        {
            await DeleteAudioAsync(extraction.Id, ct);
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

    /// <summary>Asks the AI and stores what it proposed; with a search ("find ..."), the capture has no items.</summary>
    private async Task<(AIExtraction Extraction, FeedSearch? Search)> ExtractAsync(
        Guid userId, string text, Transcript? transcript, CancellationToken ct, IReadOnlyList<MediaInput>? media = null, bool wordsGiven = true)
    {
        var (raw, normalized) = await ProposeAsync(userId, text, previousText: null, currentItem: null, ct, media, wordsGiven ? null : "");

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
        return (extraction, normalized.Search);
    }

    /// <summary>Asks the AI about <paramref name="text"/> and validates the answer.</summary>
    private async Task<(RawExtraction Raw, NormalizedExtraction Normalized)> ProposeAsync(
        Guid userId, string text, string? previousText, string? currentItem, CancellationToken ct,
        IReadOnlyList<MediaInput>? media = null, string? wordsForAi = null)
    {
        var user = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.TimeZoneId, u.Locale })
            .SingleAsync(ct);

        var timeZone = UserTimeZoneHelper.ResolveTimeZone(user.TimeZoneId);
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(_dateTime.UtcNow, timeZone);
        // Adding to one item is one item anyway; everything else follows "One entry per message".
        var oneEntry = currentItem is null && (await SettingsAsync(userId, ct)).OneEntryPerMessage;

        var knownTags = await _db.Tags.AsNoTracking().Where(t => t.UserId == userId).OrderBy(t => t.Name).Select(t => t.Name).Take(200).ToListAsync(ct);

        var started = _dateTime.UtcNow;
        var raw = await _extraction.ExtractAsync(
            new ExtractionContext(wordsForAi ?? text, localNow, timeZone.Id, user.Locale, previousText, currentItem, oneEntry, knownTags, media), ct);
        var normalized = ExtractionNormalizer.Normalize(raw, text, localNow, timeZone, user.Locale, knownTags);
        if (oneEntry) normalized = SingleEntry.Merge(normalized);
        // A tag the user already has is shown and saved with their spelling ("family" -> "Family").
        normalized = normalized with
        {
            Items = normalized.Items
                .Select(i => i.Tags is { Count: > 0 } tags
                    ? i with
                    {
                        Tags = tags.Select(t => knownTags.FirstOrDefault(k => k.Equals(t, StringComparison.OrdinalIgnoreCase)) ?? t)
                            .Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
                    }
                    : i)
                .ToList(),
        };
        // Only files, no words: the titles say what kind of file it is ("Photo: ...").
        if (wordsForAi == "" && media is { Count: > 0 })
        {
            normalized = MediaTitles.Apply(normalized, MediaTitles.Label(media.Select(m => m.Kind), ClarificationTexts.For(user.Locale)));
        }

        // Log counts and timing only - never the user's words (spec section 37).
        _logger.LogInformation(
            "Extracted {ItemCount} item(s) ({RawCount} proposed, {MediaCount} file(s) read) with {Model} in {ElapsedMs} ms",
            normalized.Items.Count, raw.Items.Count, media?.Count ?? 0, raw.ModelName, (_dateTime.UtcNow - started).TotalMilliseconds);
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
        RecurrenceFrequency = i.RecurrenceRule?.Frequency ?? i.Recurrence,
        RecurrenceInterval = i.RecurrenceRule?.Interval ?? 1,
        RecurrenceDays = ReminderSchedule.DaysMask(i.RecurrenceRule?.Days),
        Clarification = i.Clarification,
        Confidence = i.Confidence,
        AddsToCurrent = i.AddsToCurrent,
        SourceText = i.SourceText,
        Unrelated = i.Unrelated,
        ProposedReminders = ReminderPlanner.ToProposed(i.Reminders),
        ProposedTags = TagSync.Clean(i.Tags),
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

        // The item the user continues from, whole - the AI returns it updated. From
        // the Edit form: as it is in the form right now (unsaved changes included).
        var formState = request.ItemId is not null && request.ItemState is { } state ? await FormStateAsync(userId, state, ct) : null;
        var currentItem = formState is { } fs
            ? ContinuedItem.Describe(fs, await _reminders.ZoneAsync(userId, ct))
            : request.ItemId is { } itemId ? await DescribeItemAsync(userId, request.ItemType, itemId, ct) : null;
        var addedKeys = new List<string>();
        var addedRecording = false;

        // Adding to one saved item is scoped to it: the AI sees only that item and
        // what was said about it - not the rest of the message.
        var previousText = currentItem is not null
            ? await ItemWordsAsync(extraction.Id, request.ItemId!.Value, ct)
            : extraction.Transcript?.Text ?? extraction.RawInputText ?? "";
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
                // The new parts play after the existing ones. Assign a new list (not
                // Add) so EF sees the JSON column change.
                var compressed = await CompressAsync(keys, ct);
                voice.AudioStorageKeys = [.. voice.AudioStorageKeys, .. compressed];
                addedKeys.AddRange(compressed);
            }
            else
            {
                // A typed capture gets its first recording: keep it. The typed words
                // become the start of the transcript; the recording covers the rest.
                var recording = new VoiceCapture
                {
                    UserId = userId,
                    MimeType = string.IsNullOrWhiteSpace(request.Audio[0].MimeType) ? AudioExtensions[extensions[0]] : request.Audio[0].MimeType,
                    Status = VoiceCaptureStatus.Analyzed,
                    AudioStorageKeys = await CompressAsync(keys, ct),
                };
                addedKeys.AddRange(recording.AudioStorageKeys);
                addedRecording = true;
                _db.VoiceCaptures.Add(recording);
                var started = new Transcript
                {
                    UserId = userId,
                    VoiceCaptureId = recording.Id,
                    Text = extraction.RawInputText ?? "",
                    LanguageCode = parts.Select(p => p.LanguageCode).FirstOrDefault(l => l is not null),
                    ProviderName = parts[0].ProviderName,
                };
                _db.Transcripts.Add(started);
                recording.Transcript = started;
                extraction.TranscriptId = started.Id;
                extraction.Transcript = started;
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
        // For one item, exactly one proposal comes back: that item, updated.
        var proposals = normalized.Items;
        if (currentItem is not null && (formState ?? await CurrentProposalAsync(userId, request.ItemType, request.ItemId!.Value, ct)) is { } current)
        {
            proposals = [ContinuedItem.Keep(normalized.Items, current, newText)];
            // An earlier "Add more" review left unsaved is superseded by this one -
            // otherwise it would show up in this review as a change to this item.
            // (The Edit form keeps its own earlier additions until Save.)
            foreach (var leftover in extraction.Items.Where(i => i.Status == ExtractionStatus.PendingReview && !request.KeepEarlier))
            {
                leftover.Status = ExtractionStatus.Rejected;
            }
        }
        foreach (var proposed in proposals)
        {
            var item = ToItem(userId, proposed);
            item.AiExtractionId = extraction.Id;
            if (currentItem is not null)
            {
                (item.ContinuesItemType, item.ContinuesItemId) = (request.ItemType, request.ItemId);
            }
            if (request.KeepEarlier)
            {
                // The Edit form's: held there until Save or Cancel (which takes this back out).
                item.HeldByEditForm = true;
                item.AddedText = newText;
                item.AddedAudioKeys = addedKeys;
                item.AddedRecording = addedRecording;
            }
            // Explicit Add (attached only via the navigation, EF would UPDATE the pre-keyed
            // row); EF's fix-up then puts it in extraction.Items.
            _db.AIExtractionItems.Add(item);
        }
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Capture {CaptureId} continued: {Parts} audio part(s), {Items} new item(s)",
            extraction.Id, request.Audio.Count, proposals.Count);
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
        if (decision.LinkOnly)
        {
            return await LinkToItemAsync(extraction.UserId, item, decision.AppendToType!, decision.AppendToId!.Value, ct);
        }
        if (decision.AppendToId is { } targetId)
        {
            return decision.ReplacesItem
                ? await ApplyToItemAsync(item, decision.AppendToType!, targetId, decision, ct, extraction.Id)
                : await AppendToItemAsync(extraction.UserId, item, decision.AppendToType!, targetId, decision, ct);
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
                await TagSync.ApplyAsync(_db, extraction.UserId, note.NoteTags, decision.Tags ?? [], tag => new NoteTag { Note = note, Tag = tag }, ct);
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

    /// <summary>
    /// Replaces uncompressed parts with compressed copies; returns the keys to
    /// keep (in order). Best effort: any part that can't be compressed stays.
    /// </summary>
    private async Task<List<string>> CompressAsync(IReadOnlyList<string> keys, CancellationToken ct)
    {
        var result = new List<string>(keys.Count);
        foreach (var key in keys)
        {
            try
            {
                (byte[] Audio, string Extension)? compressed;
                await using (var original = await _storage.OpenReadAsync(key, ct))
                {
                    compressed = original is null ? null : await _compressor.CompressAsync(original, Path.GetExtension(key), ct);
                }
                if (compressed is { } c)
                {
                    var newKey = Path.ChangeExtension(key, c.Extension);
                    using var content = new MemoryStream(c.Audio);
                    await _storage.SaveAsync(newKey, content, ct);
                    await _storage.DeleteAsync(key, ct);
                    result.Add(newKey);
                    continue;
                }
            }
            catch (Exception ex) when (ex is IOException or InvalidOperationException or UnauthorizedAccessException)
            {
                _logger.LogWarning("Keeping a recording part uncompressed ({Error})", ex.GetType().Name);
            }
            result.Add(key);
        }
        return result;
    }

    /// <summary>What was said about one saved item in this capture (its quoted words, oldest first), or null.</summary>
    private async Task<string?> ItemWordsAsync(Guid extractionId, Guid itemId, CancellationToken ct)
    {
        var words = await _db.AIExtractionItems
            .Where(i => i.AiExtractionId == extractionId && i.SourceText != null
                && (i.ResultingTaskItemId == itemId || i.ResultingAppointmentId == itemId || i.ResultingNoteId == itemId))
            .OrderBy(i => i.CreatedAtUtc)
            .Select(i => i.SourceText!)
            .ToListAsync(ct);
        return words.Count > 0 ? string.Join("\n\n", words) : null;
    }

    /// <summary>The Edit form's current state (the AI's item shape, local times), validated like any AI answer.</summary>
    private async Task<NormalizedItem?> FormStateAsync(Guid userId, string json, CancellationToken ct)
    {
        RawExtractedItem? raw;
        try
        {
            raw = json.Length <= 20_000 ? JsonSerializer.Deserialize<RawExtractedItem>(json, FormJson) : null;
        }
        catch (JsonException)
        {
            raw = null;
        }
        if (raw is null) return null;
        var zone = await _reminders.ZoneAsync(userId, ct);
        return ExtractionNormalizer.NormalizeItem(raw, TimeZoneInfo.ConvertTimeFromUtc(_dateTime.UtcNow, zone), zone);
    }

    private static readonly JsonSerializerOptions FormJson = new() { PropertyNameCaseInsensitive = true };

    /// <summary>
    /// Cancel in the Edit form: the addition's words come out of the transcript
    /// and its recording parts out of the recording - as if it was never said.
    /// </summary>
    private async Task TakeBackAsync(AIExtraction extraction, AIExtractionItem item, CancellationToken ct)
    {
        if (!string.IsNullOrEmpty(item.AddedText))
        {
            static string? Without(string? text, string added)
            {
                if (text is null) return null;
                var at = text.LastIndexOf(added, StringComparison.Ordinal);
                return at < 0 ? text : (text[..at].TrimEnd() + text[(at + added.Length)..]).Trim();
            }
            if (extraction.Transcript is { } transcript) transcript.Text = Without(transcript.Text, item.AddedText) ?? "";
            else extraction.RawInputText = Without(extraction.RawInputText, item.AddedText);
        }

        var voice = extraction.Transcript?.VoiceCapture;
        if (voice is not null && item.AddedAudioKeys.Count > 0)
        {
            voice.AudioStorageKeys = voice.AudioStorageKeys.Where(key => !item.AddedAudioKeys.Contains(key)).ToList();
            foreach (var key in item.AddedAudioKeys) await _storage.DeleteAsync(key, ct);
        }
        if (item.AddedRecording && extraction.Transcript is { } added)
        {
            // It was a typed capture: back to that.
            added.IsDeleted = true;
            if (added.VoiceCapture is { } recording) recording.IsDeleted = true;
            extraction.TranscriptId = null;
            extraction.Transcript = null;
        }
        item.AddedText = null;
        item.AddedAudioKeys = [];
    }

    /// <summary>The item continued from, as a proposal of itself (null if it's gone).</summary>
    private async Task<NormalizedItem?> CurrentProposalAsync(Guid userId, string? type, Guid id, CancellationToken ct)
    {
        switch (type)
        {
            case "Task":
                var task = await _tasks.GetByIdAsync(id, ct);
                return task.Value is not { } t ? null : new NormalizedItem(
                    ExtractionIntent.Task, t.Title, null, t.Description, null, null, t.DueDateUtc, t.HasDueTime, null,
                    t.Priority == TaskPriority.None ? null : t.Priority, t.Reminders ?? [], t.Recurrence?.Frequency, null, null,
                    RecurrenceRule: t.Recurrence, Tags: t.Tags);
            case "Appointment":
                var appointment = await _appointments.GetByIdAsync(id, ct);
                return appointment.Value is not { } a ? null : new NormalizedItem(
                    ExtractionIntent.Appointment, a.Title, null, a.Description, a.StartUtc, a.EndUtc, null, true, a.Location,
                    null, a.Reminders ?? [], a.Recurrence?.Frequency, null, null, RecurrenceRule: a.Recurrence, Tags: a.Tags);
            case "Note":
                var note = await _db.Notes.AsNoTracking().Include(n => n.Reminders).Include(n => n.NoteTags).ThenInclude(nt => nt.Tag).FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId, ct);
                return note is null ? null : new NormalizedItem(
                    ExtractionIntent.Note, note.Title ?? note.Content[..Math.Min(note.Content.Length, ExtractionNormalizer.MaxTitleLength)], null, note.Content, null, null, null, false, null,
                    null, ReminderPlanner.ToDtos(note.Reminders), null, null, null, Tags: note.NoteTags.Select(nt => nt.Tag.Name).ToList());
            default:
                return null;
        }
    }

    /// <summary>The item continued from, as the AI's item JSON (null if it's gone).</summary>
    private async Task<string?> DescribeItemAsync(Guid userId, string? type, Guid id, CancellationToken ct)
    {
        var zone = await _reminders.ZoneAsync(userId, ct);
        switch (type)
        {
            case "Task":
                var task = await _tasks.GetByIdAsync(id, ct);
                return task.Value is not { } t ? null : ContinuedItem.Describe(
                    "task", t.Title, t.Description, t.DueDateUtc, t.HasDueTime, null, null, t.Priority, t.Reminders ?? [], zone, t.Recurrence, t.Tags);
            case "Appointment":
                var appointment = await _appointments.GetByIdAsync(id, ct);
                return appointment.Value is not { } a ? null : ContinuedItem.Describe(
                    "appointment", a.Title, a.Description, a.StartUtc, true, a.EndUtc, a.Location, null, a.Reminders ?? [], zone, a.Recurrence, a.Tags);
            case "Note":
                var note = await _db.Notes.AsNoTracking().Include(n => n.Reminders).Include(n => n.NoteTags).ThenInclude(nt => nt.Tag).FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId, ct);
                return note is null ? null : ContinuedItem.Describe(
                    "note", note.Title ?? note.Content, note.Content, null, false, null, null, null, ReminderPlanner.ToDtos(note.Reminders), zone,
                    tags: note.NoteTags.Select(nt => nt.Tag.Name));
            default:
                return null;
        }
    }

    /// <summary>
    /// "Add to this item": the reviewed proposal is the whole item after the
    /// addition (details merged, new reminder or time applied), so the existing
    /// item is updated in place through its normal service - same id, title
    /// and created date. What the proposal doesn't carry (notes, tags, people,
    /// ongoing) is kept.
    /// </summary>
    private async Task<string?> ApplyToItemAsync(
        AIExtractionItem item, string type, Guid targetId, ConfirmCaptureItem decision, CancellationToken ct, Guid? captureId = null)
    {
        // Asked to change what it is ("make it an event"): change the type first -
        // same title, created date, reminders and capture link, in this transaction -
        // then update the new item with the rest.
        var newType = decision.Intent switch
        {
            ExtractionIntent.Appointment => "Appointment",
            ExtractionIntent.Note => "Note",
            _ => "Task",
        };
        if (newType != type)
        {
            var converted = await _conversion.ConvertAsync(new ConvertItemRequest(
                type, targetId, newType, decision.StartUtc, decision.EndUtc, decision.DueUtc, decision.HasTime), ct);
            if (!converted.Succeeded) return string.Join(" ", converted.Errors);
            (type, targetId) = (newType, converted.Value!.Id);
            item.ResultingTaskItemId = item.ResultingAppointmentId = item.ResultingNoteId = null;
        }

        switch (type)
        {
            case "Task":
            {
                if ((await _tasks.GetByIdAsync(targetId, ct)).Value is not { } t) return "The task to add to was not found.";
                var updated = await _tasks.UpdateAsync(targetId, new UpdateTaskRequest(
                    TitleOr(decision, t.Title), decision.Description ?? t.Description, t.Notes, t.StartDateUtc,
                    decision.DueUtc, decision.DueUtc is not null && decision.HasTime,
                    decision.Priority ?? TaskPriority.None, t.Status == TaskItemStatus.Ongoing && decision.DueUtc is null,
                    decision.Reminders ?? [], decision.Tags ?? t.Tags, decision.DueUtc is null ? null : decision.Recurrence ?? t.Recurrence), ct);
                if (!updated.Succeeded) return string.Join(" ", updated.Errors);
                item.ResultingTaskItemId = targetId;
                return null;
            }
            case "Appointment":
            {
                if ((await _appointments.GetByIdAsync(targetId, ct)).Value is not { } a) return "The event to add to was not found.";
                var start = decision.StartUtc ?? a.StartUtc;
                var end = decision.EndUtc is { } e && e > start ? e : start + (a.EndUtc - a.StartUtc);
                var updated = await _appointments.UpdateAsync(targetId, new UpdateAppointmentRequest(
                    TitleOr(decision, a.Title), decision.Description ?? a.Description, a.Notes, start, end,
                    decision.Location ?? a.Location, a.Participants.Select(p => p.Name).ToList(), decision.Reminders ?? [],
                    decision.Recurrence ?? a.Recurrence, decision.Tags), ct);
                if (!updated.Succeeded) return string.Join(" ", updated.Errors);
                item.ResultingAppointmentId = targetId;
                return null;
            }
            default:
            {
                if ((await _notes.GetByIdAsync(targetId, ct)).Value is not { } n) return "The note to add to was not found.";
                var content = string.IsNullOrWhiteSpace(decision.Description) ? n.Content : decision.Description;
                var updated = await _notes.UpdateAsync(targetId, new SaveNoteRequest(KeepsNoteUntitled(n.Title, n.Content, decision.Title) ? null : TitleOr(decision, n.Title ?? ""), content, decision.Reminders ?? [], decision.Tags), ct);
                if (!updated.Succeeded) return string.Join(" ", updated.Errors);
                item.ResultingNoteId = targetId;
                return null;
            }
        }
    }

    /// <summary>
    /// An untitled note is shown by its first words; getting those back means
    /// "keep it untitled", not "give it this title".
    /// </summary>
    private static bool KeepsNoteUntitled(string? title, string content, string? sent) =>
        title is null && (string.IsNullOrWhiteSpace(sent)
            || string.Join(' ', content.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).StartsWith(sent.Trim().TrimEnd('…'), StringComparison.Ordinal));

    /// <summary>The title from the review (the item's own unless the user picked the AI's new one).</summary>
    private static string TitleOr(ConfirmCaptureItem decision, string current) =>
        string.IsNullOrWhiteSpace(decision.Title) ? current : decision.Title.Trim();

    /// <summary>Old "add text only" path, kept for confirm requests without the item's fields.</summary>
    /// <summary>
    /// The item's Edit page saved the fields itself: record the proposal as part
    /// of that item (so its words and audio clip belong to it), nothing more.
    /// </summary>
    private async Task<string?> LinkToItemAsync(Guid userId, AIExtractionItem item, string type, Guid targetId, CancellationToken ct)
    {
        switch (type)
        {
            case "Task":
                if (!await _db.TaskItems.AnyAsync(t => t.Id == targetId && t.UserId == userId, ct)) return "The task was not found.";
                item.ResultingTaskItemId = targetId;
                return null;
            case "Appointment":
                if (!await _db.Appointments.AnyAsync(a => a.Id == targetId && a.UserId == userId, ct)) return "The event was not found.";
                item.ResultingAppointmentId = targetId;
                return null;
            case "Note":
                if (!await _db.Notes.AnyAsync(n => n.Id == targetId && n.UserId == userId, ct)) return "The note was not found.";
                item.ResultingNoteId = targetId;
                return null;
            default:
                return "Unknown item type.";
        }
    }

    public async Task<Result<CaptureDto>> ForItemAsync(string itemType, Guid itemId, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        (Guid? Source, string Title, Action<Guid> Link)? found = itemType switch
        {
            "Task" => await _db.TaskItems.FirstOrDefaultAsync(t => t.Id == itemId && t.UserId == userId, ct) is { } t
                ? (t.SourceAiExtractionId, t.Title, id => t.SourceAiExtractionId = id) : null,
            "Appointment" => await _db.Appointments.FirstOrDefaultAsync(a => a.Id == itemId && a.UserId == userId, ct) is { } a
                ? (a.SourceAiExtractionId, a.Title, id => a.SourceAiExtractionId = id) : null,
            "Note" => await _db.Notes.FirstOrDefaultAsync(n => n.Id == itemId && n.UserId == userId, ct) is { } n
                ? (n.SourceAiExtractionId, n.Title ?? "Note", id => n.SourceAiExtractionId = id) : null,
            _ => null,
        };
        if (found is not { } item)
        {
            return Result<CaptureDto>.Failure("Item not found.");
        }
        if (item.Source is { } existing && await FindOwnedAsync(existing, track: false, ct) is { } source)
        {
            return Result<CaptureDto>.Success(ToDto(source, source.Transcript));
        }

        // Made by hand: an empty capture of its own, so voice or text can be added to it.
        var extraction = new AIExtraction
        {
            UserId = userId,
            RawInputText = "",
            RawResponseJson = "{}",
            Title = item.Title.Length > ExtractionNormalizer.MaxTitleLength ? item.Title[..ExtractionNormalizer.MaxTitleLength] : item.Title,
            ProcessedAtUtc = _dateTime.UtcNow,
            ProviderName = null,
        };
        _db.AIExtractions.Add(extraction);
        item.Link(extraction.Id);
        await _db.SaveChangesAsync(ct);
        return Result<CaptureDto>.Success(ToDto(extraction, null));
    }

    private async Task<string?> AppendToItemAsync(
        Guid userId, AIExtractionItem item, string type, Guid targetId, ConfirmCaptureItem decision, CancellationToken ct)
    {
        var addition = (string.IsNullOrWhiteSpace(decision.Description) ? decision.Title : decision.Description).Trim();
        static string Join(string? existing, string addition) =>
            string.IsNullOrWhiteSpace(existing) ? addition : $"{existing.TrimEnd()}\n\n{addition}";
        const int MaxText = 4000;
        const string TooLong = "The text would get too long - shorten what you add, or edit the item's details.";

        switch (type)
        {
            case "Task":
                var task = await _db.TaskItems.FirstOrDefaultAsync(t => t.Id == targetId && t.UserId == userId, ct);
                if (task is null) return "The task to add to was not found.";
                if (Join(task.Description, addition).Length > MaxText) return TooLong;
                task.Description = Join(task.Description, addition);
                item.ResultingTaskItemId = task.Id;
                return null;
            case "Appointment":
                var appointment = await _db.Appointments.FirstOrDefaultAsync(a => a.Id == targetId && a.UserId == userId, ct);
                if (appointment is null) return "The event to add to was not found.";
                if (Join(appointment.Description, addition).Length > MaxText) return TooLong;
                appointment.Description = Join(appointment.Description, addition);
                item.ResultingAppointmentId = appointment.Id;
                return null;
            default:
                var note = await _db.Notes.FirstOrDefaultAsync(n => n.Id == targetId && n.UserId == userId, ct);
                if (note is null) return "The note to add to was not found.";
                if (Join(note.Content, addition).Length > MaxText) return TooLong;
                note.Content = Join(note.Content, addition);
                item.ResultingNoteId = note.Id;
                return null;
        }
    }

    /// <summary>A capture item's proposed repeat rule (null: it doesn't repeat).</summary>
    private static RecurrenceDto? RuleOf(AIExtractionItem i) =>
        i.RecurrenceFrequency is RecurrenceFrequency.Daily or RecurrenceFrequency.Weekdays or RecurrenceFrequency.Weekly or RecurrenceFrequency.Monthly
            ? new RecurrenceDto(i.RecurrenceFrequency.Value, Math.Max(1, i.RecurrenceInterval),
                i.RecurrenceFrequency == RecurrenceFrequency.Weekly && i.RecurrenceDays != 0 ? ReminderSchedule.DaysFromMask(i.RecurrenceDays) : null)
            : null;

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
        Tags: i.Tags,
        Recurrence: i.DueUtc is null ? null : i.Recurrence);

    private static CreateAppointmentRequest ToAppointmentRequest(ConfirmCaptureItem i) => new(
        Title: i.Title.Trim(),
        Description: i.Description,
        Notes: null,
        StartUtc: i.StartUtc ?? default,
        EndUtc: i.EndUtc ?? default,
        Location: i.Location,
        ParticipantNames: null,
        Reminders: i.Reminders,
        Recurrence: i.Recurrence,
        Tags: i.Tags);

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
        || !ReminderPlanner.SameList(ReminderPlanner.FromProposed(item.ProposedReminders), d.Reminders)
        || !TagSync.Clean(d.Tags).SequenceEqual(item.ProposedTags);

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
        item.ProposedTags = TagSync.Clean(d.Tags);
    }

    // ---- Save (the smart button) --------------------------------------------

    /// <summary>
    /// The smart Save button (instead of "Review"): when everything was understood
    /// clearly - no question from the AI, and it would save as it is - it's saved
    /// at once. Anything unclear (an event with no time, an ambiguous date) goes
    /// to the review instead of being guessed; nothing is lost either way.
    /// </summary>
    private async Task<CaptureDto> SaveNowAsync(AIExtraction extraction, Transcript? transcript, bool saveNow, CancellationToken ct)
    {
        var pending = extraction.Items.Where(i => i.Status == ExtractionStatus.PendingReview).ToList();
        if (!saveNow || pending.Count == 0 || pending.Any(i => !string.IsNullOrWhiteSpace(i.Clarification)))
        {
            return ToDto(extraction, transcript);
        }

        var decisions = pending.Select(AsProposed).ToList();
        // Checked first: a failed confirm can leave half-made changes behind.
        if ((await ValidateAsync(decisions, ct)).Count > 0)
        {
            return ToDto(extraction, transcript);
        }
        var keep = (await SettingsAsync(extraction.UserId, ct)).KeepRecordings;
        var saved = await ConfirmAsync(extraction.Id, new ConfirmCaptureRequest(decisions, keep), ct);
        if (!saved.Succeeded)
        {
            _logger.LogWarning("Capture {CaptureId} couldn't be saved at once; left for review", extraction.Id);
            return ToDto(extraction, transcript);
        }
        return saved.Value! with { AutoSaved = true };
    }

    /// <summary>A proposal saved exactly as the AI understood it.</summary>
    private static ConfirmCaptureItem AsProposed(AIExtractionItem i) => new(
        i.Id, true, i.Intent, i.Title, i.Description, i.StartDateUtc, i.EndDateUtc, i.DueDateUtc, i.HasTime,
        i.Location, i.Priority, ReminderPlanner.FromProposed(i.ProposedReminders), Recurrence: RuleOf(i), Tags: i.ProposedTags);

    private async Task<UserSettings> SettingsAsync(Guid userId, CancellationToken ct) =>
        await _db.UserSettings.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == userId, ct) ?? new UserSettings();

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
                i.ResultingTaskItemId, i.ResultingAppointmentId, i.ResultingNoteId, i.AddsToCurrent,
                i.ContinuesItemType, i.ContinuesItemId, i.Unrelated, i.HeldByEditForm,
                RuleOf(i), i.ProposedTags))
            .ToList());

    /// <summary>Aborts a confirm transaction with a message for the user.</summary>
    private sealed class CaptureConfirmException(string message) : Exception(message);
}
