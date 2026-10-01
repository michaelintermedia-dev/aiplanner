using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Feed.DTOs;
using AiPlanner.Application.Feed.Interfaces;
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

    public FeedService(IApplicationDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<FeedPageDto> GetPageAsync(FeedQueryParameters query, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("No authenticated user.");
        bool Wants(FeedKind k) => query.Kinds.Count == 0 || query.Kinds.Contains(k);

        // ---- 1. Key rows -----------------------------------------------------
        var keys = new List<FeedKeyRow>();
        if (Wants(FeedKind.Task))
        {
            keys.AddRange(await _db.TaskItems.AsNoTracking().Where(t => t.UserId == userId)
                .Select(t => new FeedKeyRow(t.Id, FeedKind.Task, t.CreatedAtUtc, t.UpdatedAtUtc, t.DueDateUtc))
                .ToListAsync(ct));
        }
        if (Wants(FeedKind.Appointment))
        {
            keys.AddRange(await _db.Appointments.AsNoTracking().Where(a => a.UserId == userId)
                .Select(a => new FeedKeyRow(a.Id, FeedKind.Appointment, a.CreatedAtUtc, a.UpdatedAtUtc, (DateTime?)a.StartUtc))
                .ToListAsync(ct));
        }
        if (Wants(FeedKind.Note))
        {
            keys.AddRange(await _db.Notes.AsNoTracking().Where(n => n.UserId == userId)
                .Select(n => new FeedKeyRow(n.Id, FeedKind.Note, n.CreatedAtUtc, n.UpdatedAtUtc, (DateTime?)null))
                .ToListAsync(ct));
        }

        var (page, nextCursor) = FeedPager.Page(keys, query.Sort, query.Cursor, query.Take);

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

    private static string? Snippet(string? text, int max = SnippetLength)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var flat = string.Join(' ', text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return flat.Length <= max ? flat : flat[..(max - 1)].TrimEnd() + "…";
    }
}
