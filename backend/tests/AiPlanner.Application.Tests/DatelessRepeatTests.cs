using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Ai.Services;
using AiPlanner.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

/// <summary>"Remind me every day to drink water" - a dateless task's repeat is a repeating reminder (2026-10-21).</summary>
public class DatelessRepeatTests
{
    private static readonly TimeZoneInfo Moscow = TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");
    private static readonly DateTime LocalNow = new(2026, 9, 30, 15, 0, 0); // a Wednesday

    private static NormalizedItem Normalize(string recurrence, IReadOnlyList<string>? days = null, int? interval = null, IReadOnlyList<RawReminder>? reminders = null) =>
        ExtractionNormalizer.NormalizeItem(
            new RawExtractedItem("task", "Drink water", null, null, null, null, null, null, null, reminders, recurrence, null, 0.9,
                RecurrenceDays: days, RecurrenceInterval: interval),
            LocalNow, Moscow)!;

    [Fact]
    public void Every_day_without_a_date_becomes_a_daily_reminder_not_a_repeating_task()
    {
        var item = Normalize("daily");
        item.DueUtc.Should().BeNull();
        item.Recurrence.Should().BeNull();
        item.RecurrenceRule.Should().BeNull();
        item.Reminders.Should().ContainSingle(r => r.Kind == ReminderKind.Daily);
        item.Clarification.Should().NotBeNullOrEmpty(); // no time said: the review asks what time
    }

    [Fact]
    public void Weekly_on_days_becomes_a_weekly_reminder_on_those_days()
    {
        var item = Normalize("weekly", ["Monday", "Thursday"]);
        item.RecurrenceRule.Should().BeNull();
        var reminder = item.Reminders.Should().ContainSingle().Subject;
        reminder.Kind.Should().Be(ReminderKind.Weekly);
        reminder.Days.Should().BeEquivalentTo([DayOfWeek.Monday, DayOfWeek.Thursday]);
    }

    [Fact]
    public void A_repeating_reminder_already_given_is_not_doubled()
    {
        var item = Normalize("daily", reminders: [new RawReminder("daily", null, null, "08:00", null)]);
        item.Reminders.Should().ContainSingle(r => r.Kind == ReminderKind.Daily && r.Time == "08:00");
        item.RecurrenceRule.Should().BeNull();
    }

    [Fact]
    public void Monthly_has_no_reminder_kind_so_it_keeps_repeating_and_starts_today()
    {
        var item = Normalize("monthly");
        item.RecurrenceRule.Should().NotBeNull();
        item.DueUtc.Should().Be(new DateTime(2026, 9, 29, 21, 0, 0, DateTimeKind.Utc)); // today 00:00 Moscow
        item.HasTime.Should().BeFalse();
    }
}
