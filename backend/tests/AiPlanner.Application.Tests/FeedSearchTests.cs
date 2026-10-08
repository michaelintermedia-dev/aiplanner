using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Ai.Services;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class FeedSearchTests
{
    private static readonly string[] Known = ["Shopping", "work"];

    [Fact]
    public void Values_are_put_in_the_feed_filters_words()
    {
        var s = FeedSearch.From(new RawSearch(" wifi ", ["shopping"], ["note", "appointment"], "OVERDUE", "open", "repeating", true), Known);
        s.Should().BeEquivalentTo(new FeedSearch("wifi", ["Shopping"], ["Note", "Appointment"], "overdue", "Open", "Repeating", true));
    }

    [Fact]
    public void Unknown_values_are_dropped_and_a_tag_the_user_lacks_becomes_the_words()
    {
        var s = FeedSearch.From(new RawSearch(null, ["#groceries", "work"], ["recipe", "task"], "yesterday", "maybe", null, null), Known);
        s.Text.Should().Be("groceries");
        s.Tags.Should().Equal("work");
        s.Kinds.Should().Equal("Task");
        s.When.Should().BeNull();
        s.Status.Should().BeNull();
        s.FromVoice.Should().BeFalse();
    }

    [Fact]
    public void All_three_kinds_mean_everything()
    {
        FeedSearch.From(new RawSearch("x", [], ["task", "appointment", "note"], null, null, null, false), Known).Kinds.Should().BeEmpty();
    }

    [Fact]
    public void A_search_is_never_turned_into_a_note()
    {
        var raw = new RawExtraction("Find: wifi", null, [], "{}", "test", "test", new RawSearch("wifi", [], [], null, null, null, false));
        var n = ExtractionNormalizer.Normalize(raw, "find the wifi password photo", new DateTime(2026, 10, 9, 12, 0, 0), TimeZoneInfo.Utc);
        n.Items.Should().BeEmpty();
        n.Search!.Text.Should().Be("wifi");
        n.Title.Should().Be("Find: wifi");
    }
}
