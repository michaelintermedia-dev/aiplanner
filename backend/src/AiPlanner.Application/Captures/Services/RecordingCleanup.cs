using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AiPlanner.Application.Captures.Services;

/// <summary>
/// Deletes recordings nothing uses any more: every item saved from the message
/// has been deleted (or none was saved and the review is closed), and nothing
/// about it changed for <see cref="Grace"/> - so Undo, and a change of mind the
/// same day, still find the audio. The transcript is kept, like a manual
/// "Delete recording". A system job across all users (no current user).
/// </summary>
public class RecordingCleanup
{
    public static readonly TimeSpan Grace = TimeSpan.FromDays(1);

    private readonly IApplicationDbContext _db;
    private readonly IFileStorageService _storage;
    private readonly IDateTime _clock;
    private readonly ILogger<RecordingCleanup> _logger;

    public RecordingCleanup(IApplicationDbContext db, IFileStorageService storage, IDateTime clock, ILogger<RecordingCleanup> logger)
    {
        _db = db;
        _storage = storage;
        _clock = clock;
        _logger = logger;
    }

    /// <summary>Whether a recording can go (pure - unit tested).</summary>
    /// <param name="liveItems">Saved items from it that still exist.</param>
    /// <param name="pendingReview">Proposals still waiting for Save/Cancel.</param>
    /// <param name="lastTouchedUtc">The latest change to the capture, its proposals or its items (incl. deletions).</param>
    public static bool IsOrphan(int liveItems, int pendingReview, DateTime lastTouchedUtc, DateTime nowUtc) =>
        liveItems == 0 && pendingReview == 0 && nowUtc - lastTouchedUtc >= Grace;

    /// <param name="dryRun">Only report what would be deleted.</param>
    public async Task<int> RunAsync(bool dryRun = false, CancellationToken ct = default)
    {
        var now = _clock.UtcNow;
        var cutoff = now - Grace;
        // Recordings that still have audio and weren't touched within the grace period.
        var candidates = await _db.AIExtractions
            .Include(e => e.Transcript).ThenInclude(t => t!.VoiceCapture)
            .Include(e => e.Items)
            .Where(e => e.Transcript != null && e.Transcript.VoiceCapture != null && e.UpdatedAtUtc < cutoff)
            .ToListAsync(ct);

        var removed = 0;
        foreach (var extraction in candidates)
        {
            var voice = extraction.Transcript!.VoiceCapture!;
            if (voice.AudioStorageKeys.Count == 0) continue;
            var id = extraction.Id;

            var tasks = await _db.TaskItems.IgnoreQueryFilters().Where(t => t.SourceAiExtractionId == id).Select(t => new { t.IsDeleted, t.UpdatedAtUtc }).ToListAsync(ct);
            var events = await _db.Appointments.IgnoreQueryFilters().Where(a => a.SourceAiExtractionId == id).Select(a => new { a.IsDeleted, a.UpdatedAtUtc }).ToListAsync(ct);
            var notes = await _db.Notes.IgnoreQueryFilters().Where(n => n.SourceAiExtractionId == id).Select(n => new { n.IsDeleted, n.UpdatedAtUtc }).ToListAsync(ct);
            var items = tasks.Concat(events).Concat(notes).ToList();

            var lastTouched = new[] { extraction.UpdatedAtUtc, voice.UpdatedAtUtc }
                .Concat(extraction.Items.Select(i => i.UpdatedAtUtc))
                .Concat(items.Select(i => i.UpdatedAtUtc))
                .Max();
            var live = items.Count(i => !i.IsDeleted);
            var pending = extraction.Items.Count(i => i.Status == ExtractionStatus.PendingReview);
            if (!IsOrphan(live, pending, lastTouched, now)) continue;
            removed++;
            if (dryRun) continue;

            foreach (var key in voice.AudioStorageKeys)
            {
                await _storage.DeleteAsync(key, ct);
            }
            // New lists (not Clear) so EF sees the JSON column change.
            voice.AudioStorageKeys = [];
            voice.AudioPartDurationsMs = [];
        }

        if (removed > 0 && !dryRun)
        {
            await _db.SaveChangesAsync(ct);
        }
        // Counts only - never content (spec section 37).
        _logger.LogInformation("Recording cleanup{DryRun}: {Removed} unused recording(s) deleted of {Checked} checked",
            dryRun ? " (dry run - nothing deleted)" : "", removed, candidates.Count);
        return removed;
    }
}
