using AiPlanner.Application.Recurrence;
using AiPlanner.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class RecurrenceScheduleTests
{
    private static readonly TimeZoneInfo Berlin = TimeZoneInfo.FindSystemTimeZoneById("Europe/Berlin");
    private static readonly TimeZoneInfo Moscow = TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");

    /// <summary>Local wall-clock dates of the first <paramref name="n"/> occurrences.</summary>
    private static List<string> First(RecurrenceDto rule, DateTime firstLocal, int n, TimeZoneInfo? zone = null)
    {
        zone ??= Moscow;
        var firstUtc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(firstLocal, DateTimeKind.Unspecified), zone);
        return RecurrenceSchedule.All(rule, firstUtc, zone).Take(n)
            .Select(u => TimeZoneInfo.ConvertTimeFromUtc(u, zone).ToString("yyyy-MM-dd ddd HH:mm"))
            .ToList();
    }

    [Fact]
    public void Daily_every_other_day()
    {
        First(new RecurrenceDto(RecurrenceFrequency.Daily, Interval: 2), new DateTime(2026, 10, 5, 8, 0, 0), 3)
            .Should().Equal("2026-10-05 Mon 08:00", "2026-10-07 Wed 08:00", "2026-10-09 Fri 08:00");
    }

    [Fact]
    public void Weekdays_skip_the_weekend()
    {
        First(new RecurrenceDto(RecurrenceFrequency.Weekdays), new DateTime(2026, 10, 9, 9, 0, 0), 3)
            .Should().Equal("2026-10-09 Fri 09:00", "2026-10-12 Mon 09:00", "2026-10-13 Tue 09:00");
    }

    [Fact]
    public void Weekly_on_its_own_weekday_by_default()
    {
        First(new RecurrenceDto(RecurrenceFrequency.Weekly), new DateTime(2026, 10, 5, 9, 0, 0), 3)
            .Should().Equal("2026-10-05 Mon 09:00", "2026-10-12 Mon 09:00", "2026-10-19 Mon 09:00");
    }

    [Fact]
    public void Every_two_weeks_on_monday_and_thursday()
    {
        var rule = new RecurrenceDto(RecurrenceFrequency.Weekly, Interval: 2, Days: [DayOfWeek.Monday, DayOfWeek.Thursday]);
        First(rule, new DateTime(2026, 10, 5, 9, 0, 0), 4)
            .Should().Equal("2026-10-05 Mon 09:00", "2026-10-08 Thu 09:00", "2026-10-19 Mon 09:00", "2026-10-22 Thu 09:00");
    }

    [Fact]
    public void Monthly_on_the_31st_uses_the_last_day_of_shorter_months()
    {
        First(new RecurrenceDto(RecurrenceFrequency.Monthly), new DateTime(2026, 1, 31, 10, 0, 0), 4)
            .Should().Equal("2026-01-31 Sat 10:00", "2026-02-28 Sat 10:00", "2026-03-31 Tue 10:00", "2026-04-30 Thu 10:00");
    }

    [Fact]
    public void Monthly_rent_on_the_first()
    {
        First(new RecurrenceDto(RecurrenceFrequency.Monthly, MonthDay: 1), new DateTime(2026, 10, 1, 9, 0, 0), 3)
            .Should().Equal("2026-10-01 Thu 09:00", "2026-11-01 Sun 09:00", "2026-12-01 Tue 09:00");
    }

    [Fact]
    public void Count_includes_the_first_and_until_is_inclusive()
    {
        First(new RecurrenceDto(RecurrenceFrequency.Daily, Count: 3), new DateTime(2026, 10, 5, 8, 0, 0), 10).Should().HaveCount(3);
        First(new RecurrenceDto(RecurrenceFrequency.Daily, Until: new DateOnly(2026, 10, 7)), new DateTime(2026, 10, 5, 8, 0, 0), 10)
            .Should().Equal("2026-10-05 Mon 08:00", "2026-10-06 Tue 08:00", "2026-10-07 Wed 08:00");
    }

    [Fact]
    public void Keeps_the_wall_clock_time_across_daylight_saving()
    {
        // Berlin goes from summer to winter time on 2026-10-25.
        var times = First(new RecurrenceDto(RecurrenceFrequency.Weekly), new DateTime(2026, 10, 19, 9, 0, 0), 2, Berlin);
        times.Should().Equal("2026-10-19 Mon 09:00", "2026-10-26 Mon 09:00");
    }

    [Fact]
    public void Next_and_range()
    {
        var rule = new RecurrenceDto(RecurrenceFrequency.Weekly);
        var first = new DateTime(2026, 10, 5, 6, 0, 0, DateTimeKind.Utc); // Mon 09:00 Moscow
        RecurrenceSchedule.Next(rule, first, Moscow, first).Should().Be(new DateTime(2026, 10, 12, 6, 0, 0, DateTimeKind.Utc));
        RecurrenceSchedule.Occurrences(rule, first, Moscow, new DateTime(2026, 10, 10, 0, 0, 0, DateTimeKind.Utc), new DateTime(2026, 10, 25, 0, 0, 0, DateTimeKind.Utc))
            .Should().HaveCount(2);
        RecurrenceSchedule.Next(new RecurrenceDto(RecurrenceFrequency.Weekly, Count: 1), first, Moscow, first).Should().BeNull();
    }
}
