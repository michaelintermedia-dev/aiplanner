using System.Net;
using AiPlanner.Application.Ai.Services;
using AiPlanner.Application.Common.Utils;
using AiPlanner.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class LinksTests
{
    private static NormalizedExtraction One(string title, string? description) =>
        new("Capture", null, [new NormalizedItem(ExtractionIntent.Note, title, null, description, null, null, null, false, null, null, [], null, null, null)]);

    [Fact]
    public void Links_are_found_without_trailing_punctuation_and_www_gets_https()
    {
        Links.Find("Watch https://youtu.be/abc?t=10. Also www.example.com, and (https://en.wikipedia.org/wiki/Foo_(bar)).")
            .Should().Equal("https://youtu.be/abc?t=10", "https://www.example.com", "https://en.wikipedia.org/wiki/Foo_(bar)");
        Links.Find("no links here").Should().BeEmpty();
        Links.Find("same https://a.com twice https://a.com").Should().Equal("https://a.com");
    }

    [Fact]
    public void A_link_the_AI_dropped_goes_back_into_the_description_as_written()
    {
        var kept = Links.Keep(One("YouTube: Never Gonna Give You Up", "A music video"), "https://youtu.be/dQw4w9WgXcQ www.example.com").Items.Single();
        kept.Description.Should().Be("A music video\nhttps://youtu.be/dQw4w9WgXcQ\nwww.example.com");
    }

    [Fact]
    public void A_link_already_in_the_entry_is_not_added_again()
    {
        var item = One("Article", "Read later\nhttps://example.com/a");
        Links.Keep(item, "read later https://example.com/a").Should().BeSameAs(item);
        Links.Keep(One("Plain", null), "no links").Items.Single().Description.Should().BeNull();
    }

    [Fact]
    public void A_short_message_with_a_link_is_not_turned_into_a_link_title()
    {
        // "https://youtu.be/x" alone: the details keep the link; the title isn't the link.
        var fixedUp = ShortMessage.Fix(One("YouTube: a video", "https://youtu.be/x"), "https://youtu.be/x").Items.Single();
        fixedUp.Title.Should().Be("YouTube: a video");
        fixedUp.Description.Should().Be("https://youtu.be/x");
    }

    [Theory]
    [InlineData("8.8.8.8", true)]
    [InlineData("142.250.74.110", true)]
    [InlineData("2a00:1450:4001:82a::200e", true)]
    [InlineData("127.0.0.1", false)]
    [InlineData("10.1.2.3", false)]
    [InlineData("172.16.0.1", false)]
    [InlineData("172.31.255.255", false)]
    [InlineData("192.168.1.1", false)]
    [InlineData("169.254.169.254", false)] // cloud metadata
    [InlineData("100.64.0.1", false)]
    [InlineData("0.0.0.0", false)]
    [InlineData("224.0.0.1", false)]
    [InlineData("::1", false)]
    [InlineData("fe80::1", false)]
    [InlineData("fd00::1", false)]
    [InlineData("::ffff:127.0.0.1", false)] // IPv4 in IPv6 clothing
    [InlineData("::ffff:8.8.8.8", true)]
    public void Only_public_internet_addresses_are_looked_up(string ip, bool isPublic)
    {
        PublicAddress.IsPublic(IPAddress.Parse(ip)).Should().Be(isPublic);
    }
}
