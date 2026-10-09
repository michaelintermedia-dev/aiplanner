using AiPlanner.Application.Ai.Services;
using AiPlanner.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class ShortMessageTests
{
    private static NormalizedExtraction One(string title, string? description) =>
        new("Capture", null, [new NormalizedItem(ExtractionIntent.Task, title, null, description, null, null, null, false, null, null, [], null, null, null)]);

    [Theory]
    [InlineData("call Anna about the trip", "Call Anna", "About the trip", "Call Anna about the trip")]
    [InlineData("Wifi code 1234.", "Wifi code", "1234", "Wifi code 1234")]
    public void A_short_message_cut_into_title_and_a_scrap_becomes_one_title(string input, string title, string scrap, string expected)
    {
        var item = ShortMessage.Fix(One(title, scrap), input).Items.Single();
        item.Title.Should().Be(expected);
        item.Description.Should().BeNull();
    }

    [Fact]
    public void Details_with_something_new_are_kept()
    {
        // The AI added information (not just a piece of the message): leave it.
        var item = ShortMessage.Fix(One("Call Anna", "Ask about the hotel booking"), "call Anna about the trip").Items.Single();
        item.Description.Should().Be("Ask about the hotel booking");
    }

    [Fact]
    public void A_longer_message_is_left_alone()
    {
        var input = "call Anna tomorrow morning about the trip to Rome and the hotel booking";
        var item = ShortMessage.Fix(One("Call Anna", "About the trip"), input).Items.Single();
        item.Title.Should().Be("Call Anna");
        item.Description.Should().Be("About the trip");
    }
}
