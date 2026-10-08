using AiPlanner.Application.Calendar.Services;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class WeekRangeTests
{
    private static readonly TimeZoneInfo Utc = TimeZoneInfo.Utc;

    [Theory]
    // Thursday 2026-10-08 in each kind of week.
    [InlineData(DayOfWeek.Monday, "2026-10-05")]
    [InlineData(DayOfWeek.Sunday, "2026-10-04")]
    [InlineData(DayOfWeek.Saturday, "2026-10-03")]
    public void Week_StartsOnTheChosenDay(DayOfWeek firstDay, string expectedStart)
    {
        var (from, to) = CalendarService.WeekRange(new DateOnly(2026, 10, 8), Utc, firstDay);
        DateOnly.FromDateTime(from).Should().Be(DateOnly.Parse(expectedStart));
        (to - from).Should().Be(TimeSpan.FromDays(7));
    }

    [Fact]
    public void TheFirstDayItself_StartsItsOwnWeek()
    {
        var (from, _) = CalendarService.WeekRange(new DateOnly(2026, 10, 4), Utc, DayOfWeek.Sunday);
        DateOnly.FromDateTime(from).Should().Be(new DateOnly(2026, 10, 4));
    }
}
