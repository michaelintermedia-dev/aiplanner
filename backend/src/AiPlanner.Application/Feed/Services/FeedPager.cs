using System.Text;
using AiPlanner.Application.Feed.DTOs;

namespace AiPlanner.Application.Feed.Services;

/// <summary>The minimum about an item needed to order and page the feed.</summary>
/// <param name="Score">How well it matches the search words (FeedRelevance) - for the Relevance sort.</param>
/// <param name="Section">Its place in the Smart order (FeedPager.SectionOf).</param>
public record FeedKeyRow(Guid Id, FeedKind Kind, DateTime CreatedAtUtc, DateTime UpdatedAtUtc, DateTime? DateUtc, bool HighPriority = false, int Score = 0,
    FeedSection Section = FeedSection.None);

/// <summary>
/// Orders feed rows by one or more criteria (the first decides, later ones
/// break ties) and cuts them into pages with a keyset cursor (position = the
/// last row's ordering fields), so pages don't skip or repeat items when new
/// ones are added between requests. Pure logic - unit tested.
/// </summary>
public static class FeedPager
{
    public static (IReadOnlyList<FeedKeyRow> Page, string? NextCursor) Page(
        IEnumerable<FeedKeyRow> rows, FeedSort sort, string? cursor, int take) =>
        Page(rows, [sort], cursor, take);

    public static (IReadOnlyList<FeedKeyRow> Page, string? NextCursor) Page(
        IEnumerable<FeedKeyRow> rows, IReadOnlyList<FeedSort> sorts, string? cursor, int take)
    {
        take = Math.Clamp(take, 1, 100);
        if (sorts.Count == 0) sorts = [FeedSort.CreatedDesc];
        var comparer = Comparer(sorts);
        var ordered = rows.OrderBy(r => r, comparer).ToList();

        var start = 0;
        if (Decode(cursor) is { } after)
        {
            // First row strictly after the cursor position.
            start = ordered.FindIndex(r => comparer.Compare(r, after) > 0);
            if (start < 0) start = ordered.Count;
        }

        var page = ordered.Skip(start).Take(take).ToList();
        var next = start + page.Count < ordered.Count && page.Count > 0 ? Encode(page[^1]) : null;
        return (page, next);
    }

    /// <summary>
    /// The Smart order's section (spec v2): notes go to Notes; anything done (a completed or
    /// cancelled task, an event that's over) to Done; an open task past due before today to
    /// Overdue (an event that started before today is still on - Today); then today / later
    /// by the user's day; an open task without a date to No date.
    /// </summary>
    public static FeedSection SectionOf(FeedKind kind, DateTime? dateUtc, bool done, DateTime todayStartUtc, DateTime todayEndUtc)
    {
        if (kind == FeedKind.Note) return FeedSection.Notes;
        if (done) return FeedSection.Done;
        if (dateUtc is not { } date) return FeedSection.NoDate;
        if (date < todayStartUtc) return kind == FeedKind.Task ? FeedSection.Overdue : FeedSection.Today;
        return date < todayEndUtc ? FeedSection.Today : FeedSection.Upcoming;
    }

    /// <summary>
    /// Inside a section: dated ones by date, soonest (or longest overdue) first; no date and
    /// notes newest first; done the most recent first (its date, else when it last changed).
    /// </summary>
    private static int CompareWithin(FeedKeyRow a, FeedKeyRow b) => a.Section switch
    {
        FeedSection.Overdue or FeedSection.Today or FeedSection.Upcoming =>
            (a.DateUtc ?? DateTime.MaxValue).CompareTo(b.DateUtc ?? DateTime.MaxValue),
        FeedSection.Done => -(a.DateUtc ?? a.UpdatedAtUtc).CompareTo(b.DateUtc ?? b.UpdatedAtUtc),
        _ => -a.CreatedAtUtc.CompareTo(b.CreatedAtUtc),
    };

    /// <summary>The value an item is sorted by. Undated items sort after all dated ones.</summary>
    public static DateTime SortKey(FeedKeyRow r, FeedSort sort) => sort switch
    {
        FeedSort.UpdatedDesc => r.UpdatedAtUtc,
        FeedSort.DateAsc => r.DateUtc ?? DateTime.MaxValue,
        _ => r.CreatedAtUtc,
    };

    private static int CompareBy(FeedKeyRow a, FeedKeyRow b, FeedSort sort) => sort switch
    {
        FeedSort.PriorityHigh => -a.HighPriority.CompareTo(b.HighPriority),
        FeedSort.Relevance => -a.Score.CompareTo(b.Score),
        FeedSort.Smart => a.Section.CompareTo(b.Section),
        FeedSort.CreatedDesc or FeedSort.UpdatedDesc => -SortKey(a, sort).CompareTo(SortKey(b, sort)),
        _ => SortKey(a, sort).CompareTo(SortKey(b, sort)),
    };

    private static IComparer<FeedKeyRow> Comparer(IReadOnlyList<FeedSort> sorts) => Comparer<FeedKeyRow>.Create((a, b) =>
    {
        if (sorts[0] == FeedSort.Smart)
        {
            // Sections first; inside one, high priority first when asked, then the section's own order.
            var bySection = a.Section.CompareTo(b.Section);
            if (bySection != 0) return bySection;
            if (sorts.Contains(FeedSort.PriorityHigh))
            {
                var byPriority = -a.HighPriority.CompareTo(b.HighPriority);
                if (byPriority != 0) return byPriority;
            }
            var within = CompareWithin(a, b);
            if (within != 0) return within;
        }
        else
        {
            foreach (var sort in sorts)
            {
                var by = CompareBy(a, b, sort);
                if (by != 0) return by;
            }
        }
        // Exact ties (e.g. undated items by date): newest first, then a stable tiebreak.
        var byCreated = -a.CreatedAtUtc.CompareTo(b.CreatedAtUtc);
        if (byCreated != 0) return byCreated;
        var byKind = a.Kind.CompareTo(b.Kind);
        return byKind != 0 ? byKind : a.Id.CompareTo(b.Id);
    });

    // Cursor = the last row's ordering fields. Base64url so it's opaque and URL-safe.
    private static string Encode(FeedKeyRow r)
    {
        var raw = string.Join('|', r.Kind, r.Id, r.CreatedAtUtc.Ticks, r.UpdatedAtUtc.Ticks, r.DateUtc?.Ticks ?? -1, r.HighPriority ? 1 : 0, r.Score, (int)r.Section);
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
            var date = long.Parse(parts[4]);
            return new FeedKeyRow(
                Guid.Parse(parts[1]),
                Enum.Parse<FeedKind>(parts[0]),
                new DateTime(long.Parse(parts[2]), DateTimeKind.Utc),
                new DateTime(long.Parse(parts[3]), DateTimeKind.Utc),
                date < 0 ? null : new DateTime(date, DateTimeKind.Utc),
                parts[5] == "1",
                parts.Length > 6 ? int.Parse(parts[6]) : 0,
                parts.Length > 7 ? (FeedSection)int.Parse(parts[7]) : FeedSection.None);
        }
        catch (Exception e) when (e is FormatException or ArgumentException or IndexOutOfRangeException or OverflowException)
        {
            return null; // A garbled cursor restarts from the top rather than failing.
        }
    }
}
