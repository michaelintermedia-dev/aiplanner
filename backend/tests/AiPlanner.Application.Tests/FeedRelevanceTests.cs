using AiPlanner.Application.Feed.DTOs;
using AiPlanner.Application.Feed.Services;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class FeedRelevanceTests
{
    [Fact]
    public void The_whole_phrase_in_the_title_beats_scattered_words_beats_no_title_match()
    {
        var words = new[] { "car", "insurance" };
        var phrase = FeedRelevance.Score("Renew car insurance", words);
        var scattered = FeedRelevance.Score("Insurance papers for the car", words);
        var one = FeedRelevance.Score("Car service", words);
        var none = FeedRelevance.Score("Call the bank", words); // matched in its text, not its title
        phrase.Should().BeGreaterThan(scattered);
        scattered.Should().BeGreaterThan(one);
        one.Should().BeGreaterThan(none);
        none.Should().Be(0);
    }

    [Fact]
    public void A_title_that_is_exactly_the_search_comes_first()
    {
        var words = new[] { "wifi" };
        FeedRelevance.Score("wifi", words).Should().BeGreaterThan(FeedRelevance.Score("wifi password at the cabin", words));
        FeedRelevance.Score("Wi-Fi", words).Should().Be(0); // the search words come normalized like the query
    }

    [Fact]
    public void Best_match_first_then_newest_and_paging_keeps_the_order()
    {
        var t0 = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);
        var rows = Enumerable.Range(0, 7)
            .Select(i => new FeedKeyRow(Guid.NewGuid(), FeedKind.Note, t0.AddHours(i), t0.AddHours(i), null, false, Score: i % 3 * 10))
            .ToList();
        var sorts = new[] { FeedSort.Relevance, FeedSort.CreatedDesc };
        var all = FeedPager.Page(rows, sorts, null, 100).Page;
        all.Select(r => r.Score).Should().BeInDescendingOrder();

        var seen = new List<FeedKeyRow>();
        string? cursor = null;
        do
        {
            var (page, next) = FeedPager.Page(rows, sorts, cursor, 3);
            seen.AddRange(page);
            cursor = next;
        } while (cursor is not null);
        seen.Should().Equal(all); // nothing skipped or repeated across pages
    }
}
