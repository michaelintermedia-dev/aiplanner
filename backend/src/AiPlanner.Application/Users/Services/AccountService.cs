using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Models;
using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AiPlanner.Application.Users.Services;

/// <summary>
/// The account itself (production prep, 2026-10-12; required by Google Play /
/// the App Store and privacy law): download everything, or delete everything.
/// </summary>
public class AccountService
{
    public const string WrongEmail = "Type your account's email to confirm.";
    public const string WrongPassword = "Your password isn't right.";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IFileStorageService _storage;
    private readonly IPasswordHasher _passwords;
    private readonly IDateTime _clock;
    private readonly ILogger<AccountService> _logger;

    public AccountService(IApplicationDbContext db, ICurrentUserService currentUser, IFileStorageService storage, IDateTime clock, ILogger<AccountService> logger, IPasswordHasher passwords)
    {
        _passwords = passwords;
        _db = db;
        _currentUser = currentUser;
        _storage = storage;
        _clock = clock;
        _logger = logger;
    }

    /// <summary>
    /// Deletes the account and everything in it for good - every row (soft-deleted
    /// ones too) and every file. Nothing is kept but the AI usage counts, which
    /// no longer point at anyone (the operator's cost totals stay right).
    /// Backups still hold it until they expire (14 days) - the privacy page says so.
    /// </summary>
    public async Task<Result> DeleteAsync(string confirmEmail, string? password, CancellationToken ct = default)
    {
        if (_currentUser.UserId is not { } id) return Result.Failure("Not signed in.");
        var user = await _db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return Result.Failure("Not signed in.");
        if (!string.Equals(confirmEmail?.Trim(), user.Email, StringComparison.OrdinalIgnoreCase)) return Result.Failure(WrongEmail);
        if (!string.IsNullOrEmpty(user.PasswordHash) && !_passwords.Verify(password ?? "", user.PasswordHash)) return Result.Failure(WrongPassword);

        // The files to remove once the rows are gone.
        var keys = new List<string>();
        keys.AddRange(await _db.Attachments.IgnoreQueryFilters().Where(a => a.UserId == id).Select(a => a.StorageKey).ToListAsync(ct));
        foreach (var audio in await _db.VoiceCaptures.IgnoreQueryFilters().Where(v => v.UserId == id).Select(v => v.AudioStorageKeys).ToListAsync(ct))
        {
            keys.AddRange(audio);
        }
        var wallpaper = await _db.UserSettings.Where(s => s.UserId == id).Select(s => s.WallpaperPhotoKey).FirstOrDefaultAsync(ct);
        if (wallpaper is not null) keys.Add(wallpaper);

        await _db.ExecuteInTransactionAsync(async t =>
        {
            // Children before parents (notifications point at items and reminders without cascading).
            await _db.Notifications.IgnoreQueryFilters().Where(x => x.UserId == id).ExecuteDeleteAsync(t);
            await _db.Attachments.IgnoreQueryFilters().Where(x => x.UserId == id).ExecuteDeleteAsync(t);
            await _db.Reminders.IgnoreQueryFilters().Where(x => x.UserId == id).ExecuteDeleteAsync(t);
            await _db.Items.IgnoreQueryFilters().Where(x => x.UserId == id).ExecuteDeleteAsync(t); // + participants, tag links
            await _db.RecurrenceRules.IgnoreQueryFilters().Where(x => x.UserId == id).ExecuteDeleteAsync(t);
            await _db.Tags.IgnoreQueryFilters().Where(x => x.UserId == id).ExecuteDeleteAsync(t);
            await _db.AIExtractionItems.IgnoreQueryFilters().Where(x => x.UserId == id).ExecuteDeleteAsync(t);
            await _db.AIExtractions.IgnoreQueryFilters().Where(x => x.UserId == id).ExecuteDeleteAsync(t);
            await _db.Transcripts.IgnoreQueryFilters().Where(x => x.UserId == id).ExecuteDeleteAsync(t);
            await _db.VoiceCaptures.IgnoreQueryFilters().Where(x => x.UserId == id).ExecuteDeleteAsync(t);
            await _db.EmailCodes.Where(x => x.UserId == id).ExecuteDeleteAsync(t);
            await _db.PushSubscriptions.Where(x => x.UserId == id).ExecuteDeleteAsync(t);
            await _db.AiUsages.Where(x => x.UserId == id).ExecuteUpdateAsync(s => s.SetProperty(x => x.UserId, (Guid?)null), t);
            await _db.Users.IgnoreQueryFilters().Where(x => x.Id == id).ExecuteDeleteAsync(t); // + settings, sessions, Google/Apple links
            return true;
        }, ct);

        // Files last: a failure here leaves orphan files (swept below), never rows pointing at missing files.
        foreach (var key in keys.Distinct())
        {
            try { await _storage.DeleteAsync(key, ct); }
            catch (Exception ex) { _logger.LogWarning(ex, "Account delete: could not delete a file"); }
        }
        foreach (var folder in new[] { id.ToString(), id.ToString("N") })
        {
            try { await _storage.DeleteFolderAsync(folder, ct); }
            catch (Exception ex) { _logger.LogWarning(ex, "Account delete: could not delete a folder"); }
        }
        _logger.LogInformation("Account {UserId} deleted ({Files} files)", id, keys.Count);
        return Result.Success();
    }

    /// <summary>
    /// Everything the account holds as a ZIP: data.json (account, settings, every
    /// task / event / note with its reminders, repeat rule and tags, every capture
    /// with its words) plus the files - photos and documents, recordings, the
    /// wallpaper photo. Deleted items are left out.
    /// </summary>
    public async Task<Result> ExportAsync(Stream zip, CancellationToken ct = default)
    {
        if (_currentUser.UserId is not { } id) return Result.Failure("Not signed in.");
        var user = await _db.Users.AsNoTracking().Include(u => u.Settings).FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return Result.Failure("Not signed in.");

        var tags = await _db.Tags.AsNoTracking().Where(t => t.UserId == id).ToDictionaryAsync(t => t.Id, t => t.Name, ct);
        var reminders = (await _db.Reminders.AsNoTracking().Where(r => r.UserId == id && !r.IsCancelled).ToListAsync(ct))
            .ToLookup(r => r.TaskItemId ?? r.AppointmentId ?? r.NoteId);
        var rules = await _db.RecurrenceRules.AsNoTracking().Where(r => r.UserId == id).ToDictionaryAsync(r => r.Id, ct);
        var taskTags = (await _db.TaskTags.AsNoTracking().Where(x => x.TaskItem.UserId == id).ToListAsync(ct)).ToLookup(x => x.TaskItemId, x => x.TagId);
        var eventTags = (await _db.AppointmentTags.AsNoTracking().Where(x => x.Appointment.UserId == id).ToListAsync(ct)).ToLookup(x => x.AppointmentId, x => x.TagId);
        var noteTags = (await _db.NoteTags.AsNoTracking().Where(x => x.Note.UserId == id).ToListAsync(ct)).ToLookup(x => x.NoteId, x => x.TagId);
        var people = (await _db.AppointmentParticipants.AsNoTracking().Where(p => p.Appointment.UserId == id).ToListAsync(ct))
            .ToLookup(p => p.AppointmentId, p => p.Name);

        List<string> TagNames(IEnumerable<Guid> ids) => ids.Where(tags.ContainsKey).Select(t => tags[t]).Order().ToList();
        List<object> RemindersOf(Guid item) => reminders[item]
            .Select(r => (object)new { r.Kind, r.MinutesBefore, TimeOfDay = r.TimeOfDay?.ToString("HH:mm"), r.DaysOfWeek, NextUtc = r.TriggerAtUtc, Paused = r.PausedWithItem })
            .ToList();
        object? RuleOf(Guid? rule) => rule is { } r && rules.TryGetValue(r, out var x)
            ? new { x.Frequency, x.Interval, x.ByDay, x.ByMonthDay, UntilUtc = x.EndsOnUtc, TimesLeft = x.MaxOccurrences }
            : null;

        var items = new List<object>();
        foreach (var t in await _db.TaskItems.AsNoTracking().Where(x => x.UserId == id).OrderBy(x => x.CreatedAtUtc).ToListAsync(ct))
        {
            items.Add(new
            {
                Type = "Task", t.Id, t.Title, Text = t.Description, t.Status, t.Priority, DueUtc = t.DueDateUtc, t.HasDueTime, t.CompletedAtUtc,
                t.Location, People = t.People.Count > 0 ? t.People : null, Tags = TagNames(taskTags[t.Id]), Reminders = RemindersOf(t.Id),
                Repeats = RuleOf(t.RecurrenceRuleId), CaptureId = t.SourceAiExtractionId, t.CreatedAtUtc, t.UpdatedAtUtc,
            });
        }
        foreach (var a in await _db.Appointments.AsNoTracking().Where(x => x.UserId == id).OrderBy(x => x.CreatedAtUtc).ToListAsync(ct))
        {
            items.Add(new
            {
                Type = "Event", a.Id, a.Title, Text = a.Description, a.Status, a.Priority, a.StartUtc, a.EndUtc, a.Location,
                People = people[a.Id].ToList(), Tags = TagNames(eventTags[a.Id]), Reminders = RemindersOf(a.Id), Repeats = RuleOf(a.RecurrenceRuleId),
                SkippedUtc = a.SkippedOccurrencesUtc.Count > 0 ? a.SkippedOccurrencesUtc : null, CaptureId = a.SourceAiExtractionId, a.CreatedAtUtc, a.UpdatedAtUtc,
            });
        }
        foreach (var n in await _db.Notes.AsNoTracking().Where(x => x.UserId == id).OrderBy(x => x.CreatedAtUtc).ToListAsync(ct))
        {
            items.Add(new
            {
                Type = "Note", n.Id, n.Title, Text = n.Content, n.Priority, n.Location, People = n.People.Count > 0 ? n.People : null,
                Tags = TagNames(noteTags[n.Id]), Reminders = RemindersOf(n.Id), CaptureId = n.SourceAiExtractionId, n.CreatedAtUtc, n.UpdatedAtUtc,
            });
        }

        var files = new List<(string Path, string Key)>();
        var attachments = new List<object>();
        foreach (var a in await _db.Attachments.AsNoTracking().Where(x => x.UserId == id).OrderBy(x => x.CreatedAtUtc).ToListAsync(ct))
        {
            var path = $"files/{a.Id:N}-{Safe(a.FileName)}";
            files.Add((path, a.StorageKey));
            attachments.Add(new { a.ItemType, a.ItemId, a.FileName, a.Kind, a.SizeBytes, a.Description, File = path, a.CreatedAtUtc });
        }

        var captures = new List<object>();
        var voice = await _db.VoiceCaptures.AsNoTracking().Include(v => v.Transcript).Where(v => v.UserId == id).ToListAsync(ct);
        var byTranscript = voice.Where(v => v.Transcript is not null).ToDictionary(v => v.Transcript!.Id);
        foreach (var e in await _db.AIExtractions.AsNoTracking().Where(x => x.UserId == id).OrderBy(x => x.CreatedAtUtc).ToListAsync(ct))
        {
            var recording = e.TranscriptId is { } tid && byTranscript.TryGetValue(tid, out var v) ? v : null;
            var audio = new List<string>();
            for (var i = 0; i < (recording?.AudioStorageKeys.Count ?? 0); i++)
            {
                var key = recording!.AudioStorageKeys[i];
                var path = $"recordings/{e.Id:N}-{i + 1}{Path.GetExtension(key)}";
                files.Add((path, key));
                audio.Add(path);
            }
            captures.Add(new
            {
                e.Id, e.Title, e.Summary, Words = recording?.Transcript?.Text ?? e.RawInputText, Source = recording is null ? "Typed" : "Voice",
                Recording = audio.Count > 0 ? audio : null, e.CreatedAtUtc,
            });
        }

        string? wallpaper = null;
        if (user.Settings?.WallpaperPhotoKey is { } wkey)
        {
            wallpaper = $"wallpaper{Path.GetExtension(wkey)}";
            files.Add((wallpaper, wkey));
        }

        var data = new
        {
            ExportedAtUtc = _clock.UtcNow,
            Account = new { user.Email, user.DisplayName, user.TimeZoneId, user.Locale, user.CreatedAtUtc },
            Settings = user.Settings is { } s
                ? new
                {
                    Notifications = new { s.NotificationsEnabled, s.TaskRemindersEnabled, s.AppointmentRemindersEnabled, s.DailySummaryEnabled, DailySummaryTime = s.DailySummaryTime.ToString(@"hh\:mm") },
                    Appearance = new { s.Theme, s.Skin, s.Wallpaper, WallpaperPhoto = wallpaper },
                    s.FirstDayOfWeek,
                    s.KeepRecordings,
                    s.AiReadsMedia,
                }
                : null,
            Items = items,
            Tags = tags.Values.Order().ToList(),
            Attachments = attachments,
            Captures = captures,
        };

        using (var archive = new ZipArchive(zip, ZipArchiveMode.Create, leaveOpen: true))
        {
            await using (var entry = await archive.CreateEntry("data.json").OpenAsync(ct))
            {
                await JsonSerializer.SerializeAsync(entry, data, Json, ct);
            }
            await using (var readme = await archive.CreateEntry("README.txt").OpenAsync(ct))
            {
                await readme.WriteAsync(Encoding.UTF8.GetBytes(
                    "Gatazee - your data\r\n\r\n" +
                    "data.json   your account, settings, every task, event and note (with reminders, repeat rules and tags)\r\n" +
                    "            and every capture with the words you typed or said. Times are UTC.\r\n" +
                    "files/      photos and documents attached to your items\r\n" +
                    "recordings/ your voice recordings (one capture can have several parts)\r\n"), ct);
            }
            foreach (var (path, key) in files)
            {
                await using var source = await _storage.OpenReadAsync(key, ct);
                if (source is null) continue; // already gone
                await using var target = await archive.CreateEntry(path, CompressionLevel.Fastest).OpenAsync(ct);
                await source.CopyToAsync(target, ct);
            }
        }
        return Result.Success();
    }

    /// <summary>A file name safe inside a ZIP on any system.</summary>
    private static string Safe(string name)
    {
        var bad = Path.GetInvalidFileNameChars().Concat(['/', '\\', ':']).ToHashSet();
        var clean = new string(name.Select(c => bad.Contains(c) ? '_' : c).ToArray()).Trim();
        return clean.Length == 0 ? "file" : clean.Length > 100 ? clean[^100..] : clean;
    }
}
