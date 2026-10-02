using AiPlanner.Application.Notifications.Services;
using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Entities;
using AiPlanner.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class NotificationScheduleTests
{
    // Moscow is UTC+3 all year. Window: Wednesday 2026-09-30 15:00 local (12:00 UTC) + 3 days.
    private static readonly TimeZoneInfo Moscow = TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");
    private static readonly DateTime From = new(2026, 9, 30, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime To = From.AddDays(3);

    private static DateTime Utc(int month, int day, int hour, int minute = 0) => new(2026, month, day, hour, minute, 0, DateTimeKind.Utc);

    [Fact]
    public void One_off_reminder_goes_off_once_if_inside_the_window()
    {
        var inside = new Reminder { Kind = ReminderKind.At, TriggerAtUtc = Utc(10, 1, 6) };
        var outside = new Reminder { Kind = ReminderKind.At, TriggerAtUtc = Utc(10, 9, 6) };

        NotificationSchedule.Occurrences(inside, From, To, Moscow).Should().Equal(Utc(10, 1, 6));
        NotificationSchedule.Occurrences(outside, From, To, Moscow).Should().BeEmpty();
    }

    [Fact]
    public void Daily_reminder_goes_off_every_day_in_the_window()
    {
        var daily = new Reminder { Kind = ReminderKind.Daily, TimeOfDay = new TimeOnly(8, 0) };

        // 08:00 Moscow = 05:00 UTC; today's 08:00 has passed (window starts at 15:00 local).
        NotificationSchedule.Occurrences(daily, From, To, Moscow).Should().Equal(Utc(10, 1, 5), Utc(10, 2, 5), Utc(10, 3, 5));
    }

    [Fact]
    public void Weekly_reminder_only_on_its_days()
    {
        var weekly = new Reminder
        {
            Kind = ReminderKind.Weekly,
            TimeOfDay = new TimeOnly(19, 30),
            DaysOfWeek = ReminderSchedule.DaysMask([DayOfWeek.Wednesday, DayOfWeek.Friday]),
        };

        // Wed Sep 30 19:30 (later today) and Fri Oct 2 19:30, local.
        NotificationSchedule.Occurrences(weekly, From, To, Moscow).Should().Equal(Utc(9, 30, 16, 30), Utc(10, 2, 16, 30));
    }

    [Fact]
    public void Turned_off_reminders_never_go_off()
    {
        var off = new Reminder { Kind = ReminderKind.Daily, TimeOfDay = new TimeOnly(8, 0), IsCancelled = true };

        NotificationSchedule.Occurrences(off, From, To, Moscow).Should().BeEmpty();
    }

    [Theory]
    [InlineData("Appointment", 30, "Starts in 30 minutes")]
    [InlineData("Appointment", 0, "Starting now")]
    [InlineData("Task", 60, "Due in 1 hour")]
    [InlineData("Task", 0, "Due now")]
    [InlineData("Appointment", 1440, "Starts in 1 day")]
    public void Before_reminders_say_how_long_until_the_item(string itemType, int minutes, string expected)
    {
        var r = new Reminder { Kind = ReminderKind.Before, MinutesBefore = minutes };

        NotificationSchedule.ReminderBody(r, itemType, Utc(10, 1, 10), Utc(10, 1, 9), Moscow).Should().Be(expected);
    }

    [Fact]
    public void Other_reminders_mention_the_item_time()
    {
        var r = new Reminder { Kind = ReminderKind.At };

        NotificationSchedule.ReminderBody(r, "Appointment", Utc(10, 1, 14), Utc(10, 1, 9), Moscow).Should().Be("Starts at 17:00");
        NotificationSchedule.ReminderBody(r, "Task", Utc(10, 2, 14), Utc(10, 1, 9), Moscow).Should().Be("Due Fri 2 Oct, 17:00");
        NotificationSchedule.ReminderBody(r, "Note", null, Utc(10, 1, 9), Moscow).Should().Be("Note reminder");
    }

    [Fact]
    public void Daily_summary_reads_naturally_and_is_skipped_when_empty()
    {
        NotificationSchedule.DailySummary(3, 1, 2, 1).Should().Be("3 tasks due today (1 important) · 2 overdue · 1 event");
        NotificationSchedule.DailySummary(1, 0, 0, 0).Should().Be("1 task due today");
        NotificationSchedule.DailySummary(0, 0, 0, 0).Should().BeNull();
    }

    [Theory]
    [InlineData(5, "5 minutes")]
    [InlineData(90, "1 h 30 min")]
    [InlineData(120, "2 hours")]
    [InlineData(2880, "2 days")]
    public void Durations_are_humanized(int minutes, string expected) =>
        NotificationSchedule.Humanize(minutes).Should().Be(expected);

    [Fact]
    public void Texts_follow_the_users_language()
    {
        var ru = NotificationTexts.For("ru-RU");
        NotificationSchedule.DailySummary(3, 0, 2, 1, ru).Should().Be("3 задачи на сегодня · просрочено: 2 · 1 событие");
        NotificationSchedule.Humanize(5, ru).Should().Be("5 минут");
        NotificationSchedule.Humanize(21, ru).Should().Be("21 минуту");
        NotificationSchedule.Humanize(120, NotificationTexts.For("he")).Should().Be("שעתיים");
        NotificationTexts.For("fr-FR").Should().BeSameAs(NotificationTexts.English);
        NotificationTexts.For(null).Should().BeSameAs(NotificationTexts.English);
    }
}
