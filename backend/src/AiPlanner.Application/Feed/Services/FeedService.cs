using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Feed.DTOs;
using AiPlanner.Application.Feed.Interfaces;
using AiPlanner.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Feed.Services;

/// <summary>
/// Builds the feed in two steps: (1) load small key rows for all of the user's
/// matching items and let <see cref="FeedPager"/> order and page them, then
/// (2) load full details for just that page. Personal data is hundreds to a
/// few thousand rows, so step 1 stays cheap; it avoids a three-table UNION
/// with keyset predicates in SQL.
/// </summary>
public class FeedService : IFeedService
{
    private const int SnippetLength = 160;

    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTime _clock;

    public FeedService(IApplicationDbContext db, ICurrentUserService currentUser, IDateTime clock)
    {
        _db = db;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<FeedPageDto> GetPageAsync(FeedQueryParameters query, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("No authenticated user.");
        var f = query.Filter ?? FeedFilter.None;
        var text = string.IsNullOrWhiteSpace(f.Text) ? null : f.Text.Trim();
        var now = _clock.UtcNow;
        var dated = f.DateFromUtc is not null || f.DateToUtc is not null;
        var tags = f.Tags?.Select(t => t.Trim()).Where(t => t.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).ToList() ?? [];
        // Notes have no status or date of their own, so those filters leave them out.
        bool Wants(FeedKind k) => (query.Kinds.Count == 0 || query.Kinds.Contains(k))
            && !(k == FeedKind.Note && (f.Status != FeedStatusFilter.Any || dated))
            && !(k != FeedKind.Task && tags.Count > 0); // only tasks have tags

        // ---- 1. Key rows (filtered) -----------------------------------------
        var keys = new List<FeedKeyRow>();
        if (Wants(FeedKind.Task))
        {
            var q = _db.TaskItems.AsNoTracking().Where(t => t.UserId == userId);
            if (text is not null)
            {
                q = q.Where(t => t.Title.Contains(text) || (t.Description != null && t.Description.Contains(text))
                    || (t.Notes != null && t.Notes.Contains(text)) || t.TaskTags.Any(tt => tt.Tag.Name.Contains(text)));
            }
            if (f.CreatedFromUtc is { } cFrom) q = q.Where(t => t.CreatedAtUtc >= cFrom);
            if (f.CreatedToUtc is { } cTo) q = q.Where(t => t.CreatedAtUtc < cTo);
            q = f.Reminders switch
            {
                FeedReminderFilter.With => q.Where(t => t.Reminders.Any(r => !r.IsCancelled)),
                FeedReminderFilter.Repeating => q.Where(t => t.Reminders.Any(r => !r.IsCancelled
                    && (r.Kind == ReminderKind.Daily || r.Kind == ReminderKind.Weekdays || r.Kind == ReminderKind.Weekly))),
                FeedReminderFilter.Without => q.Where(t => !t.Reminders.Any(r => !r.IsCancelled)),
                _ => q,
            };
            q = f.Status switch
            {
                FeedStatusFilter.Open => q.Where(t => t.Status != TaskItemStatus.Completed && t.Status != TaskItemStatus.Cancelled),
                FeedStatusFilter.Done => q.Where(t => t.Status == TaskItemStatus.Completed || t.Status == TaskItemStatus.Cancelled),
                _ => q,
            };
            if (f.DateFromUtc is { } dFrom) q = q.Where(t => t.DueDateUtc >= dFrom);
            if (f.DateToUtc is { } dTo) q = q.Where(t => t.DueDateUtc < dTo);
            if (f.NoDate) q = q.Where(t => t.DueDateUtc == null);
            if (f.FromVoice) q = q.Where(t => t.SourceAiExtraction != null && t.SourceAiExtraction.TranscriptId != null);
            if (tags.Count > 0) q = q.Where(t => t.TaskTags.Any(tt => tags.Contains(tt.Tag.Name)));
            keys.AddRange(await q.Select(t => new FeedKeyRow(t.Id, FeedKind.Task, t.CreatedAtUtc, t.UpdatedAtUtc, t.DueDateUtc, t.Priority == TaskPriority.High)).ToListAsync(ct));
        }
        if (Wants(FeedKind.Appointment) && !f.NoDate) // every event has a date
        {
            var q = _db.Appointments.AsNoTracking().Where(a => a.UserId == userId);
            if (text is not null)
            {
                q = q.Where(a => a.Title.Contains(text) || (a.Description != null && a.Description.Contains(text))
                    || (a.Notes != null && a.Notes.Contains(text)) || (a.Location != null && a.Location.Contains(text)));
            }
            if (f.CreatedFromUtc is { } cFrom) q = q.Where(a => a.CreatedAtUtc >= cFrom);
            if (f.CreatedToUtc is { } cTo) q = q.Where(a => a.CreatedAtUtc < cTo);
            q = f.Reminders switch
            {
                FeedReminderFilter.With => q.Where(a => a.Reminders.Any(r => !r.IsCancelled)),
                FeedReminderFilter.Repeating => q.Where(a => a.Reminders.Any(r => !r.IsCancelled
                    && (r.Kind == ReminderKind.Daily || r.Kind == ReminderKind.Weekdays || r.Kind == ReminderKind.Weekly))),
                FeedReminderFilter.Without => q.Where(a => !a.Reminders.Any(r => !r.IsCancelled)),
                _ => q,
            };
            // A scheduled event that has ended counts as done ("passed").
            q = f.Status switch
            {
                FeedStatusFilter.Open => q.Where(a => a.Status == AppointmentStatus.Scheduled && a.EndUtc >= now),
                FeedStatusFilter.Done => q.Where(a => a.Status != AppointmentStatus.Scheduled || a.EndUtc < now),
                _ => q,
            };
            if (f.DateFromUtc is { } dFrom) q = q.Where(a => a.StartUtc >= dFrom);
            if (f.DateToUtc is { } dTo) q = q.Where(a => a.StartUtc < dTo);
            if (f.FromVoice) q = q.Where(a => a.SourceAiExtraction != null && a.SourceAiExtraction.TranscriptId != null);
            keys.AddRange(await q.Select(a => new FeedKeyRow(a.Id, FeedKind.Appointment, a.CreatedAtUtc, a.UpdatedAtUtc, (DateTime?)a.StartUtc)).ToListAsync(ct));
        }
        if (Wants(FeedKind.Note))
        {
            var q = _db.Notes.AsNoTracking().Where(n => n.UserId == userId);
            if (text is not null) q = q.Where(n => (n.Title != null && n.Title.Contains(text)) || n.Content.Contains(text));
            if (f.CreatedFromUtc is { } cFrom) q = q.Where(n => n.CreatedAtUtc >= cFrom);
            if (f.CreatedToUtc is { } cTo) q = q.Where(n => n.CreatedAtUtc < cTo);
            q = f.Reminders switch
            {
                FeedReminderFilter.With => q.Where(n => n.Reminders.Any(r => !r.IsCancelled)),
                FeedReminderFilter.Repeating => q.Where(n => n.Reminders.Any(r => !r.IsCancelled
                    && (r.Kind == ReminderKind.Daily || r.Kind == ReminderKind.Weekdays || r.Kind == ReminderKind.Weekly))),
                FeedReminderFilter.Without => q.Where(n => !n.Reminders.Any(r => !r.IsCancelled)),
                _ => q,
            };
            if (f.FromVoice) q = q.Where(n => n.SourceAiExtraction != null && n.SourceAiExtraction.TranscriptId != null);
            keys.AddRange(await q.Select(n => new FeedKeyRow(n.Id, FeedKind.Note, n.CreatedAtUtc, n.UpdatedAtUtc, (DateTime?)null)).ToListAsync(ct));
        }

        var (page, nextCursor) = FeedPager.Page(keys, query.Sorts, query.Cursor, query.Take);

        // ---- 2. Details for this page only -----------------------------------
        var ids = page.ToLookup(r => r.Kind, r => r.Id);
        var details = new Dictionary<Guid, FeedItemDto>();

        var taskIds = ids[FeedKind.Task].ToList();
        if (taskIds.Count > 0)
        {
            var tasks = await _db.TaskItems.AsNoTracking()
                .Where(t => t.UserId == userId && taskIds.Contains(t.Id))
                .Select(t => new
                {
                    t.Id, t.Title, t.Description, t.Status, t.DueDateUtc, t.HasDueTime, t.Priority,
                    Tags = t.TaskTags.Select(tt => tt.Tag.Name).ToList(),
                    t.SourceAiExtractionId, t.CreatedAtUtc, t.UpdatedAtUtc,
                })
                .ToListAsync(ct);
            foreach (var t in tasks)
            {
                details[t.Id] = new FeedItemDto(
                    t.Id, FeedKind.Task, t.Title, Snippet(t.Description), t.Status.ToString(), t.DueDateUtc, null,
                    t.DueDateUtc is not null && t.HasDueTime,
                    t.Priority == Domain.Enums.TaskPriority.None ? null : t.Priority.ToString(), null,
                    t.Tags.OrderBy(n => n).ToList(), t.SourceAiExtractionId is not null, t.CreatedAtUtc, t.UpdatedAtUtc);
            }
        }

        var appointmentIds = ids[FeedKind.Appointment].ToList();
        if (appointmentIds.Count > 0)
        {
            var appointments = await _db.Appointments.AsNoTracking()
                .Where(a => a.UserId == userId && appointmentIds.Contains(a.Id))
                .Select(a => new { a.Id, a.Title, a.Description, a.Status, a.StartUtc, a.EndUtc, a.Location, a.SourceAiExtractionId, a.CreatedAtUtc, a.UpdatedAtUtc })
                .ToListAsync(ct);
            foreach (var a in appointments)
            {
                details[a.Id] = new FeedItemDto(
                    a.Id, FeedKind.Appointment, a.Title, Snippet(a.Description), a.Status.ToString(), a.StartUtc, a.EndUtc,
                    true, null, a.Location, [], a.SourceAiExtractionId is not null, a.CreatedAtUtc, a.UpdatedAtUtc);
            }
        }

        var noteIds = ids[FeedKind.Note].ToList();
        if (noteIds.Count > 0)
        {
            var notes = await _db.Notes.AsNoTracking()
                .Where(n => n.UserId == userId && noteIds.Contains(n.Id))
                .Select(n => new { n.Id, n.Title, n.Content, n.SourceAiExtractionId, n.CreatedAtUtc, n.UpdatedAtUtc })
                .ToListAsync(ct);
            foreach (var n in notes)
            {
                // A note's "title" is its title, or else the start of its text.
                var title = string.IsNullOrWhiteSpace(n.Title) ? Snippet(n.Content, 80)! : n.Title;
                var snippet = n.Title is not null && n.Title != n.Content ? Snippet(n.Content) : null;
                details[n.Id] = new FeedItemDto(
                    n.Id, FeedKind.Note, title, snippet, null, null, null, false, null, null, [],
                    n.SourceAiExtractionId is not null, n.CreatedAtUtc, n.UpdatedAtUtc);
            }
        }

        // Keep the pager's order; skip anything deleted between the two steps.
        var items = page.Where(r => details.ContainsKey(r.Id)).Select(r => details[r.Id]).ToList();
        return new FeedPageDto(items, nextCursor);
    }

    public async Task<IReadOnlyList<FeedTagDto>> GetTagsAsync(CancellationToken ct = default)
    {
        var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("No authenticated user.");
        // Counted from the user's tasks, so deleted tasks (query filter) don't count.
        var counts = await _db.TaskItems.AsNoTracking()
            .Where(t => t.UserId == userId)
            .SelectMany(t => t.TaskTags.Select(tt => tt.Tag.Name))
            .GroupBy(name => name)
            .Select(g => new { Name = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        return counts.OrderByDescending(t => t.Count).ThenBy(t => t.Name).Select(t => new FeedTagDto(t.Name, t.Count)).ToList();
    }

    private static string? Snippet(string? text, int max = SnippetLength)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var flat = string.Join(' ', text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return flat.Length <= max ? flat : flat[..(max - 1)].TrimEnd() + "…";
    }
}
