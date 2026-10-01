using System.Text;
using AiPlanner.Application.Feed.DTOs;

namespace AiPlanner.Application.Feed.Services;

/// <summary>The minimum about an item needed to order and page the feed.</summary>
public record FeedKeyRow(Guid Id, FeedKind Kind, DateTime CreatedAtUtc, DateTime UpdatedAtUtc, DateTime? DateUtc);

/// <summary>
/// Orders feed rows and cuts them into pages with a keyset cursor (position =
/// sort key + kind + id), so pages don't skip or repeat items when new ones
/// are added between requests. Pure logic - unit tested.
/// </summary>
public static class FeedPager
{
    public static (IReadOnlyList<FeedKeyRow> Page, string? NextCursor) Page(
        IEnumerable<FeedKeyRow> rows, FeedSort sort, string? cursor, int take)
    {
        take = Math.Clamp(take, 1, 100);
        var ordered = rows.OrderBy(r => r, Comparer(sort)).ToList();

        var start = 0;
        if (Decode(cursor) is { } after)
        {
            // First row strictly after the cursor position.
            var comparer = Comparer(sort);
            start = ordered.FindIndex(r => comparer.Compare(r, after) > 0);
            if (start < 0) start = ordered.Count;
        }

        var page = ordered.Skip(start).Take(take).ToList();
        var next = start + page.Count < ordered.Count && page.Count > 0 ? Encode(page[^1], sort) : null;
        return (page, next);
    }

    /// <summary>The value an item is sorted by. Undated items sort after all dated ones.</summary>
    public static DateTime SortKey(FeedKeyRow r, FeedSort sort) => sort switch
    {
        FeedSort.UpdatedDesc => r.UpdatedAtUtc,
        FeedSort.DateAsc => r.DateUtc ?? DateTime.MaxValue,
        _ => r.CreatedAtUtc,
    };

    private static IComparer<FeedKeyRow> Comparer(FeedSort sort) => Comparer<FeedKeyRow>.Create((a, b) =>
    {
        var byKey = SortKey(a, sort).CompareTo(SortKey(b, sort));
        if (sort is FeedSort.CreatedDesc or FeedSort.UpdatedDesc) byKey = -byKey;
        if (byKey != 0) return byKey;
        // Undated items (DateAsc) and exact ties: newest first, then a stable tiebreak.
        var byCreated = -a.CreatedAtUtc.CompareTo(b.CreatedAtUtc);
        if (sort == FeedSort.DateAsc && byCreated != 0) return byCreated;
        var byKind = a.Kind.CompareTo(b.Kind);
        return byKind != 0 ? byKind : a.Id.CompareTo(b.Id);
    });

    // Cursor = the last row's ordering fields. Base64url so it's opaque and URL-safe.
    private static string Encode(FeedKeyRow r, FeedSort sort)
    {
        var raw = string.Join('|', (int)sort, r.Kind, r.Id, r.CreatedAtUtc.Ticks, r.UpdatedAtUtc.Ticks, r.DateUtc?.Ticks ?? -1);
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(raw)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static FeedKeyRow? Decode(string? cursor)
    {
        if (string.IsNullOrWhiteSpace(cursor)) return null;
        try
        {
            var b64 = cursor.Replace('-', '+').Replace('_', '/');
            b64 = b64.PadRight(b64.Length + (4 - b64.Length % 4) % 4, '=');
            var parts = Encoding.UTF8.GetString(Convert.FromBase64String(b64)).Split('|');
            var date = long.Parse(parts[5]);
            return new FeedKeyRow(
                Guid.Parse(parts[2]),
                Enum.Parse<FeedKind>(parts[1]),
                new DateTime(long.Parse(parts[3]), DateTimeKind.Utc),
                new DateTime(long.Parse(parts[4]), DateTimeKind.Utc),
                date < 0 ? null : new DateTime(date, DateTimeKind.Utc));
        }
        catch (Exception e) when (e is FormatException or ArgumentException or IndexOutOfRangeException or OverflowException)
        {
            return null; // A garbled cursor restarts from the top rather than failing.
        }
    }
}
