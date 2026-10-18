using AiPlanner.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AiPlanner.Application.Items.Services;

/// <summary>
/// Erases for good what was deleted 30 days ago (2026-10-18; the privacy policy
/// says so). A delete only marks an item (Undo, and later sync, need that); after
/// <see cref="KeepDays"/> the item goes with its reminders, notifications,
/// attachments (rows and files) and repeat rule. A capture (typed words or a
/// recording with its transcript) goes too once no item is left from it and it's
/// older than that. Run with the recording cleanup (every six hours).
/// </summary>
public class DeletedItemPurge
{
    public const int KeepDays = 30;
    private const int Batch = 500;
    private Guid? _onlyUser;

    private readonly IApplicationDbContext _db;
    private readonly IFileStorageService _files;
    private readonly IDateTime _clock;
    private readonly ILogger<DeletedItemPurge> _logger;

    public DeletedItemPurge(IApplicationDbContext db, IFileStorageService files, IDateTime clock, ILogger<DeletedItemPurge> logger)
    {
        _db = db;
        _files = files;
        _clock = clock;
        _logger = logger;
    }

    /// <param name="onlyUserId">Limits it to one account (QA runs it on the test account only).</param>
    public async Task RunAsync(CancellationToken ct = default, Guid? onlyUserId = null)
    {
        _onlyUser = onlyUserId;
        var cutoff = _clock.UtcNow.AddDays(-KeepDays);
        var items = await PurgeItemsAsync(cutoff, ct);
        var captures = await PurgeCapturesAsync(cutoff, ct);
        if (items + captures > 0) _logger.LogInformation("Purged {Items} deleted item(s) and {Captures} capture(s) older than {Days} days", items, captures, KeepDays);
    }

    private async Task<int> PurgeItemsAsync(DateTime cutoff, CancellationToken ct)
    {
        var ids = await _db.Items.IgnoreQueryFilters()
            .Where(i => i.IsDeleted && i.UpdatedAtUtc < cutoff && (_onlyUser == null || i.UserId == _onlyUser))
            .OrderBy(i => i.UpdatedAtUtc).Select(i => i.Id).Take(Batch).ToListAsync(ct);
        if (ids.Count == 0) return 0;

        var rules = (await _db.TaskItems.IgnoreQueryFilters().Where(t => ids.Contains(t.Id) && t.RecurrenceRuleId != null).Select(t => t.RecurrenceRuleId!.Value).ToListAsync(ct))
            .Concat(await _db.Appointments.IgnoreQueryFilters().Where(a => ids.Contains(a.Id) && a.RecurrenceRuleId != null).Select(a => a.RecurrenceRuleId!.Value).ToListAsync(ct))
            .ToList();
        var files = await _db.Attachments.IgnoreQueryFilters().Where(a => ids.Contains(a.ItemId)).Select(a => a.StorageKey).ToListAsync(ct);

        await _db.ExecuteInTransactionAsync(async t =>
        {
            // Notifications point at items without cascading - they go first.
            await _db.Notifications.IgnoreQueryFilters()
                .Where(n => (n.TaskItemId != null && ids.Contains(n.TaskItemId.Value))
                    || (n.AppointmentId != null && ids.Contains(n.AppointmentId.Value))
                    || (n.NoteId != null && ids.Contains(n.NoteId.Value)))
                .ExecuteDeleteAsync(t);
            await _db.Attachments.IgnoreQueryFilters().Where(a => ids.Contains(a.ItemId)).ExecuteDeleteAsync(t);
            // The capture's proposals stop pointing at them (plain ids, no foreign key).
            await _db.AIExtractionItems.IgnoreQueryFilters().Where(x => x.ResultingTaskItemId != null && ids.Contains(x.ResultingTaskItemId.Value))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.ResultingTaskItemId, (Guid?)null), t);
            await _db.AIExtractionItems.IgnoreQueryFilters().Where(x => x.ResultingAppointmentId != null && ids.Contains(x.ResultingAppointmentId.Value))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.ResultingAppointmentId, (Guid?)null), t);
            await _db.AIExtractionItems.IgnoreQueryFilters().Where(x => x.ResultingNoteId != null && ids.Contains(x.ResultingNoteId.Value))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.ResultingNoteId, (Guid?)null), t);
            await _db.AIExtractionItems.IgnoreQueryFilters().Where(x => x.ContinuesItemId != null && ids.Contains(x.ContinuesItemId.Value))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.ContinuesItemId, (Guid?)null), t);
            await _db.Items.IgnoreQueryFilters().Where(i => ids.Contains(i.Id)).ExecuteDeleteAsync(t); // + reminders, tag links, participants
            if (rules.Count > 0) await _db.RecurrenceRules.IgnoreQueryFilters().Where(r => rules.Contains(r.Id)).ExecuteDeleteAsync(t);
            return true;
        }, ct);

        // Files after the rows: a failure leaves an orphan file, never a row pointing at a missing one.
        foreach (var key in files.Where(k => !string.IsNullOrEmpty(k)).Distinct()) await DeleteFileAsync(key, ct);
        return ids.Count;
    }

    private async Task<int> PurgeCapturesAsync(DateTime cutoff, CancellationToken ct)
    {
        // Captures older than the cutoff that no item (live or deleted) comes from any more.
        var used = _db.TaskItems.IgnoreQueryFilters().Where(x => x.SourceAiExtractionId != null).Select(x => x.SourceAiExtractionId!.Value)
            .Concat(_db.Appointments.IgnoreQueryFilters().Where(x => x.SourceAiExtractionId != null).Select(x => x.SourceAiExtractionId!.Value))
            .Concat(_db.Notes.IgnoreQueryFilters().Where(x => x.SourceAiExtractionId != null).Select(x => x.SourceAiExtractionId!.Value));
        var captures = await _db.AIExtractions.IgnoreQueryFilters()
            .Where(c => c.CreatedAtUtc < cutoff && c.UpdatedAtUtc < cutoff && !used.Contains(c.Id) && (_onlyUser == null || c.UserId == _onlyUser))
            .OrderBy(c => c.CreatedAtUtc).Select(c => new { c.Id, c.TranscriptId }).Take(Batch).ToListAsync(ct);
        if (captures.Count == 0) return 0;

        var ids = captures.Select(c => c.Id).ToList();
        var transcripts = captures.Where(c => c.TranscriptId != null).Select(c => c.TranscriptId!.Value).ToList();
        var recordings = await _db.Transcripts.IgnoreQueryFilters().Where(x => transcripts.Contains(x.Id)).Select(x => x.VoiceCaptureId).ToListAsync(ct);
        var audio = (await _db.VoiceCaptures.IgnoreQueryFilters().Where(v => recordings.Contains(v.Id)).Select(v => v.AudioStorageKeys).ToListAsync(ct)).SelectMany(k => k).ToList();

        await _db.ExecuteInTransactionAsync(async t =>
        {
            await _db.AIExtractionItems.IgnoreQueryFilters().Where(x => ids.Contains(x.AiExtractionId)).ExecuteDeleteAsync(t);
            await _db.AIExtractions.IgnoreQueryFilters().Where(x => ids.Contains(x.Id)).ExecuteDeleteAsync(t);
            await _db.VoiceCaptures.IgnoreQueryFilters().Where(v => recordings.Contains(v.Id)).ExecuteDeleteAsync(t); // + its transcript
            return true;
        }, ct);

        foreach (var key in audio.Where(k => !string.IsNullOrEmpty(k)).Distinct()) await DeleteFileAsync(key, ct);
        return ids.Count;
    }

    private async Task DeleteFileAsync(string key, CancellationToken ct)
    {
        try
        {
            await _files.DeleteAsync(key, ct);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            _logger.LogWarning("Purge: file {Key} not deleted: {Error}", key, e.Message);
        }
    }
}
