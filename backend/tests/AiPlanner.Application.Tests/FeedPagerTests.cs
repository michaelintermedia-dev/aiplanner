using AiPlanner.Application.Feed.DTOs;
using AiPlanner.Application.Feed.Services;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class FeedPagerTests
{
    private static readonly DateTime T0 = new(2026, 10, 1, 9, 0, 0, DateTimeKind.Utc);

    private static FeedKeyRow Row(int createdMinutes, FeedKind kind = FeedKind.Task, int? dateMinutes = null, int? updatedMinutes = null) =>
        new(Guid.NewGuid(), kind, T0.AddMinutes(createdMinutes), T0.AddMinutes(updatedMinutes ?? createdMinutes),
            dateMinutes is null ? null : T0.AddMinutes(dateMinutes.Value));

    /// <summary>Reads every page and returns rows in the order the client would see them.</summary>
    private static List<FeedKeyRow> ReadAll(List<FeedKeyRow> rows, FeedSort sort, int take)
    {
        var seen = new List<FeedKeyRow>();
        string? cursor = null;
        for (var guard = 0; guard < 100; guard++)
        {
            var (page, next) = FeedPager.Page(rows, sort, cursor, take);
            seen.AddRange(page);
            if (next is null) break;
            cursor = next;
        }
        return seen;
    }

    [Fact]
    public void Newest_first_by_default_and_pages_cover_everything_exactly_once()
    {
        var rows = Enumerable.Range(0, 25).Select(i => Row(i, (FeedKind)(i % 3))).ToList();

        var all = ReadAll(rows, FeedSort.CreatedDesc, take: 7);

        all.Should().HaveCount(25).And.OnlyHaveUniqueItems();
        all.Select(r => r.CreatedAtUtc).Should().BeInDescendingOrder();
    }

    [Fact]
    public void Oldest_first_and_recently_updated_orders()
    {
        var rows = new List<FeedKeyRow> { Row(1, updatedMinutes: 50), Row(2, updatedMinutes: 10), Row(3, updatedMinutes: 30) };

        ReadAll(rows, FeedSort.CreatedAsc, 10).Select(r => r.CreatedAtUtc).Should().BeInAscendingOrder();
        ReadAll(rows, FeedSort.UpdatedDesc, 10).Select(r => r.UpdatedAtUtc).Should().BeInDescendingOrder();
    }

    [Fact]
    public void By_date_puts_soonest_first_and_undated_items_last_newest_first()
    {
        var later = Row(1, dateMinutes: 500);
        var sooner = Row(2, dateMinutes: 100);
        var olderNote = Row(3, FeedKind.Note);
        var newerNote = Row(4, FeedKind.Note);

        var all = ReadAll([olderNote, later, newerNote, sooner], FeedSort.DateAsc, 2);

        all.Should().Equal(sooner, later, newerNote, olderNote);
    }

    [Fact]
    public void Identical_timestamps_still_page_without_gaps_or_repeats()
    {
        var rows = Enumerable.Range(0, 12).Select(_ => Row(0)).ToList(); // all created at the same instant

        ReadAll(rows, FeedSort.CreatedDesc, 5).Should().HaveCount(12).And.OnlyHaveUniqueItems();
    }

    [Fact]
    public void Items_added_after_the_first_page_do_not_shift_later_pages()
    {
        var rows = Enumerable.Range(0, 10).Select(i => Row(i)).ToList();
        var (first, cursor) = FeedPager.Page(rows, FeedSort.CreatedDesc, null, 4);

        rows.Add(Row(100)); // a brand-new item appears at the top meanwhile
        var (second, _) = FeedPager.Page(rows, FeedSort.CreatedDesc, cursor, 4);

        second.Should().NotIntersectWith(first);
        second.First().CreatedAtUtc.Should().BeBefore(first.Last().CreatedAtUtc);
    }

    [Theory]
    [InlineData("not-a-cursor")]
    [InlineData("")]
    [InlineData(null)]
    public void A_missing_or_garbled_cursor_starts_from_the_top(string? cursor)
    {
        var rows = Enumerable.Range(0, 3).Select(i => Row(i)).ToList();

        var (page, _) = FeedPager.Page(rows, FeedSort.CreatedDesc, cursor, 10);

        page.Should().HaveCount(3);
    }

    [Fact]
    public void Last_page_has_no_next_cursor()
    {
        var rows = Enumerable.Range(0, 4).Select(i => Row(i)).ToList();

        FeedPager.Page(rows, FeedSort.CreatedDesc, null, 4).NextCursor.Should().BeNull();
        FeedPager.Page(rows, FeedSort.CreatedDesc, null, 3).NextCursor.Should().NotBeNull();
    }
}
