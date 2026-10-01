using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class ReminderScheduleTests
{
    // Moscow is UTC+3 all year. Now: Wednesday 2026-09-30 15:00 local = 12:00 UTC.
    private static readonly TimeZoneInfo Moscow = TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");
    private static readonly DateTime NowUtc = new(2026, 9, 30, 12, 0, 0, DateTimeKind.Utc);

    private static DateTime? Next(ReminderKind kind, string? time = null, int days = 0, DateTime? at = null, int? before = null, DateTime? item = null) =>
        ReminderSchedule.NextUtc(kind, at, before, ReminderSchedule.ParseTime(time), days, item, NowUtc, Moscow);

    private static DateTime Utc(int month, int day, int hour, int minute = 0) => new(2026, month, day, hour, minute, 0, DateTimeKind.Utc);

    [Fact]
    public void Daily_later_today_goes_off_today() =>
        Next(ReminderKind.Daily, "18:00").Should().Be(Utc(9, 30, 15));

    [Fact]
    public void Daily_already_passed_today_goes_off_tomorrow() =>
        Next(ReminderKind.Daily, "08:00").Should().Be(Utc(10, 1, 5));

    [Fact]
    public void Weekdays_skip_the_weekend()
    {
        // From Wednesday afternoon the next is Thursday 08:00; from Friday after 08:00 it is Monday.
        Next(ReminderKind.Weekdays, "08:00").Should().Be(Utc(10, 1, 5));
        ReminderSchedule.NextUtc(ReminderKind.Weekdays, null, null, new TimeOnly(8, 0), 0, null, Utc(10, 2, 6), Moscow)
            .Should().Be(Utc(10, 5, 5));
    }

    [Fact]
    public void Weekly_picks_the_next_chosen_day()
    {
        var mondayAndSaturday = ReminderSchedule.DaysMask([DayOfWeek.Monday, DayOfWeek.Saturday]);
        Next(ReminderKind.Weekly, "10:00", mondayAndSaturday).Should().Be(Utc(10, 3, 7)); // Saturday
    }

    [Fact]
    public void Weekly_on_today_after_its_time_waits_a_week()
    {
        var wednesday = ReminderSchedule.DaysMask([DayOfWeek.Wednesday]);
        Next(ReminderKind.Weekly, "09:00", wednesday).Should().Be(Utc(10, 7, 6));
    }

    [Fact]
    public void Before_counts_back_from_the_item_and_needs_one()
    {
        Next(ReminderKind.Before, before: 30, item: Utc(10, 1, 10)).Should().Be(Utc(10, 1, 9, 30));
        Next(ReminderKind.Before, before: 30).Should().BeNull();
    }

    [Fact]
    public void At_is_the_fixed_moment() =>
        Next(ReminderKind.At, at: Utc(10, 3, 6)).Should().Be(Utc(10, 3, 6));

    [Fact]
    public void Repeating_without_a_time_or_days_cannot_be_scheduled()
    {
        Next(ReminderKind.Daily).Should().BeNull();
        Next(ReminderKind.Weekly, "10:00", days: 0).Should().BeNull();
    }

    [Fact]
    public void Days_mask_round_trips() =>
        ReminderSchedule.DaysFromMask(ReminderSchedule.DaysMask([DayOfWeek.Sunday, DayOfWeek.Friday]))
            .Should().Equal(DayOfWeek.Sunday, DayOfWeek.Friday);
}
