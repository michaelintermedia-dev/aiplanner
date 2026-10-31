using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Ai.Services;
using AiPlanner.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

/// <summary>Spec v2: every new event gets the user's usual reminder unless one was said or none was asked for.</summary>
public class EventDefaultReminderTests
{
    private static readonly TimeZoneInfo Moscow = TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");
    private static readonly DateTime LocalNow = new(2026, 9, 30, 15, 0, 0);

    private static NormalizedItem Item(string intent, IReadOnlyList<RawReminder>? reminders = null, bool noReminder = false, int? usual = 15) =>
        ExtractionNormalizer.NormalizeItem(
            new RawExtractedItem(intent, "Dentist", null, null, "2026-10-05", "16:00", null, null, null, reminders, null, null, 0.9, NoReminder: noReminder),
            LocalNow, Moscow, eventReminderMinutes: usual)!;

    [Fact]
    public void An_event_with_no_reminder_said_gets_the_usual_one()
    {
        var r = Item("appointment").Reminders.Should().ContainSingle().Subject;
        r.Kind.Should().Be(ReminderKind.Before);
        r.MinutesBefore.Should().Be(15);
    }

    [Fact]
    public void A_reminder_that_was_said_wins()
    {
        Item("appointment", [new RawReminder("before", 60, null, null, null)]).Reminders.Should().ContainSingle(r => r.MinutesBefore == 60);
    }

    [Fact]
    public void No_reminder_when_asked_for_none_or_turned_off_or_not_an_event()
    {
        Item("appointment", noReminder: true).Reminders.Should().BeEmpty();
        Item("appointment", usual: 0).Reminders.Should().BeEmpty();
        Item("appointment", usual: null).Reminders.Should().BeEmpty();
        Item("task").Reminders.Should().BeEmpty();
    }

    [Fact]
    public void A_search_answer_is_not_a_search_any_more_the_words_are_kept()
    {
        var raw = new RawExtraction("Find my car keys", null, [], "{}", "test", "m",
            new RawSearch("car keys", null, null, null, null, null, false));
        var result = ExtractionNormalizer.Normalize(raw, "Find my car keys", LocalNow, Moscow);
        result.Search.Should().BeNull();
        result.Items.Should().ContainSingle();
    }
}
