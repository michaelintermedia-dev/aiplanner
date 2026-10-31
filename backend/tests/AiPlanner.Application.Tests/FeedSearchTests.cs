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
        s.Should().BeEquivalentTo(new FeedSearch("wifi shopping", [], ["Note", "Appointment"], "overdue", "Open", "Repeating", true),
            "tags are searched as words, like everything else");
    }

    [Fact]
    public void Unknown_values_are_dropped_and_tags_join_the_words_once()
    {
        var s = FeedSearch.From(new RawSearch("Work stuff", ["#groceries", "work"], ["recipe", "task"], "yesterday", "maybe", null, null), Known);
        s.Text.Should().Be("Work stuff groceries");
        s.Tags.Should().BeEmpty();
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

    // (Capture no longer searches - spec v2, 2026-10-31; see EventDefaultReminderTests.)
}
