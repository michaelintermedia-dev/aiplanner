using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Captures.Services;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class AudioSnippetsTests
{
    /// <summary>Words 500 ms apart, each 400 ms long, starting at 0.</summary>
    private static List<TimedWord> Words(string text, int startMs = 0) =>
        text.Split(' ').Select((w, i) => new TimedWord(w, startMs + i * 500, startMs + i * 500 + 400)).ToList();

    private const string Said =
        "Buy milk on the way home. Then call Anna about the design review on Friday at three. And book the dentist next week.";

    [Fact]
    public void Each_item_gets_the_stretch_where_it_was_said()
    {
        var words = Words(Said);

        var milk = AudioSnippets.Find("Buy milk on the way home.", words, 60_000);
        var anna = AudioSnippets.Find("call Anna about the design review on Friday at three", words, 60_000);
        var dentist = AudioSnippets.Find("book the dentist next week", words, 60_000);

        // "Buy" is word 0, "home." word 5; "call" 7 .. "three." 16; "book" 18 .. "week." 22.
        milk.Should().Be((0, 5 * 500 + 400 + 450));
        anna.Should().Be((7 * 500 - 250, 16 * 500 + 400 + 450));
        dentist.Should().Be((18 * 500 - 250, 22 * 500 + 400 + 450));
    }

    [Fact]
    public void Small_differences_between_the_two_transcriptions_still_match()
    {
        // The quote came from the text model, the timings from another one.
        var words = Words("Okay so remind me to call Ana tomorrow at 9 about the contract renewal please");

        var range = AudioSnippets.Find("Remind me to call Anna tomorrow at nine about the contract renewal.", words, 60_000);

        range.Should().NotBeNull();
        range!.Value.StartMs.Should().Be(2 * 500 - 250); // from "remind"
        range.Value.EndMs.Should().Be(13 * 500 + 400 + 450); // through "renewal"
    }

    [Fact]
    public void Works_in_Russian()
    {
        var words = Words("Купить молоко по дороге домой. Позвонить Ане насчёт отчёта в пятницу.");

        var range = AudioSnippets.Find("позвонить Ане насчет отчета в пятницу", words, 60_000);

        range.Should().Be((5 * 500 - 250, 10 * 500 + 400 + 450));
    }

    [Fact]
    public void A_quote_that_was_not_said_is_not_placed()
    {
        AudioSnippets.Find("water the plants on Saturday morning", Words(Said), 60_000).Should().BeNull();
        AudioSnippets.Find("", Words(Said), 60_000).Should().BeNull();
        AudioSnippets.Find(null, Words(Said), 60_000).Should().BeNull();
    }

    [Fact]
    public void Parts_are_placed_back_to_back_on_one_timeline()
    {
        var parts = new[]
        {
            new TranscriptionResult("a", null, "t", Words("first part words"), DurationMs: 2000),
            new TranscriptionResult("b", null, "t", Words("second part here"), DurationMs: 3000),
        };

        var timeline = AudioSnippets.Timeline(parts, offsetMs: 10_000)!.Value;

        timeline.PartDurationsMs.Should().Equal(2000, 3000);
        timeline.Words[3].Should().Be(new TimedWord("second", 12_000, 12_400));
        AudioSnippets.Find("second part here", timeline.Words, 15_000).Should().Be((12_000 - 250, 13_000 + 400 + 450));
    }

    [Fact]
    public void A_part_without_timings_means_no_timeline()
    {
        var parts = new[]
        {
            new TranscriptionResult("a", null, "t", Words("first"), DurationMs: 1000),
            new TranscriptionResult("b", null, "t"),
        };

        AudioSnippets.Timeline(parts).Should().BeNull();
    }
}
