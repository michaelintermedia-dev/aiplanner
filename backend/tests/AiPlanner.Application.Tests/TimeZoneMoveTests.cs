using AiPlanner.Application.Common.Utils;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class TimeZoneMoveTests
{
    private static readonly TimeZoneInfo Jerusalem = TimeZoneInfo.FindSystemTimeZoneById("Asia/Jerusalem");
    private static readonly TimeZoneInfo NewYork = TimeZoneInfo.FindSystemTimeZoneById("America/New_York");
    private static readonly TimeZoneInfo Tokyo = TimeZoneInfo.FindSystemTimeZoneById("Asia/Tokyo");

    [Fact]
    public void A_date_without_a_time_stays_on_the_same_day()
    {
        // "Oct 20" in Jerusalem (UTC+3) = Oct 19 21:00 UTC; in New York it's midnight there, Oct 20 04:00 UTC.
        var jerusalemMidnight = new DateTime(2026, 10, 19, 21, 0, 0, DateTimeKind.Utc);
        var moved = TimeZoneMove.AllDay(jerusalemMidnight, Jerusalem, NewYork);
        moved.Should().Be(new DateTime(2026, 10, 20, 4, 0, 0, DateTimeKind.Utc));
        moved.Kind.Should().Be(DateTimeKind.Utc);
        TimeZoneMove.AllDay(moved, NewYork, Tokyo).Should().Be(new DateTime(2026, 10, 19, 15, 0, 0, DateTimeKind.Utc)); // Oct 20 00:00 in Tokyo
    }

    [Fact]
    public void Same_offset_moves_nothing()
    {
        var utc = new DateTime(2026, 10, 19, 21, 0, 0, DateTimeKind.Utc);
        TimeZoneMove.AllDay(utc, Jerusalem, Jerusalem).Should().Be(utc);
    }

    [Theory]
    [InlineData("Europe/Rome", true)]
    [InlineData("UTC", true)]
    [InlineData("Mars/Olympus", false)]
    [InlineData("", false)]
    public void Only_known_zones(string id, bool ok) => TimeZoneMove.IsValid(id).Should().Be(ok);
}
