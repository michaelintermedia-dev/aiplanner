using AiPlanner.Application.Notifications.Services;
using AiPlanner.Application.Recurrence;
using AiPlanner.Domain.Entities;
using AiPlanner.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

/// <summary>Once an event is over, none of its reminders go off (user's rule, 2026-10-15).</summary>
public class PassedEventRemindersTests
{
    private static readonly TimeZoneInfo Moscow = TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");
    private static DateTime Utc(int day, int hour) => new(2026, 10, day, hour, 0, 0, DateTimeKind.Utc);

    private static Appointment Event(int day, RecurrenceRule? rule = null) =>
        new() { Title = "Dentist", StartUtc = Utc(day, 9), EndUtc = Utc(day, 10), RecurrenceRule = rule };

    [Fact]
    public void A_one_off_event_ends_at_its_end()
    {
        EventOccurrences.SeriesEnd(Event(5), Moscow).Should().Be(Utc(5, 10));
    }

    [Fact]
    public void A_daily_reminder_on_a_one_off_event_stops_when_it_ends()
    {
        var daily = new Reminder { Kind = ReminderKind.Daily, TimeOfDay = new TimeOnly(8, 0) }; // 05:00 UTC
        var stop = EventOccurrences.SeriesEnd(Event(5), Moscow);
        NotificationSchedule.Occurrences(daily, Utc(1, 0), Utc(20, 0), Moscow, stop)
            .Should().Equal(Utc(1, 5), Utc(2, 5), Utc(3, 5), Utc(4, 5), Utc(5, 5));
    }

    [Fact]
    public void A_one_time_reminder_after_the_event_never_goes_off_but_one_before_does()
    {
        var stop = EventOccurrences.SeriesEnd(Event(5), Moscow);
        var after = new Reminder { Kind = ReminderKind.At, TriggerAtUtc = Utc(6, 9) };
        var before = new Reminder { Kind = ReminderKind.Before, MinutesBefore = 0, TriggerAtUtc = Utc(5, 9) };
        NotificationSchedule.Occurrences(after, Utc(1, 0), Utc(20, 0), Moscow, stop).Should().BeEmpty();
        NotificationSchedule.Occurrences(before, Utc(1, 0), Utc(20, 0), Moscow, stop).Should().Equal(Utc(5, 9));
    }

    [Fact]
    public void A_repeating_event_with_an_end_stops_after_its_last_date_one_without_never_stops()
    {
        var threeTimes = Event(5, new RecurrenceRule { Frequency = RecurrenceFrequency.Daily, Interval = 1, MaxOccurrences = 3 });
        EventOccurrences.SeriesEnd(threeTimes, Moscow).Should().Be(Utc(7, 10));

        var forever = Event(5, new RecurrenceRule { Frequency = RecurrenceFrequency.Daily, Interval = 1 });
        EventOccurrences.SeriesEnd(forever, Moscow).Should().BeNull();
    }
}
