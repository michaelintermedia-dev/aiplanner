using System.Text.Json;
using AiPlanner.Application.Captures.Services;
using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class ContinuedItemTests
{
    private static readonly TimeZoneInfo Moscow = TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");

    [Fact]
    public void The_item_is_described_in_the_answer_shape_with_local_times()
    {
        var json = ContinuedItem.Describe(
            "appointment", "Call Anna", "About the review", new DateTime(2026, 10, 9, 12, 0, 0, DateTimeKind.Utc), true,
            new DateTime(2026, 10, 9, 13, 0, 0, DateTimeKind.Utc), "Office", null,
            [
                new ReminderDto(ReminderKind.Before, MinutesBefore: 30),
                new ReminderDto(ReminderKind.At, AtUtc: new DateTime(2026, 10, 8, 6, 0, 0, DateTimeKind.Utc)),
                new ReminderDto(ReminderKind.Weekly, Time: "09:00", Days: [DayOfWeek.Monday]),
            ],
            Moscow);

        var root = JsonDocument.Parse(json).RootElement;
        root.GetProperty("title").GetString().Should().Be("Call Anna");
        root.GetProperty("date").GetString().Should().Be("2026-10-09");
        root.GetProperty("time").GetString().Should().Be("15:00"); // UTC+3
        root.GetProperty("endTime").GetString().Should().Be("16:00");
        root.GetProperty("priority").ValueKind.Should().Be(JsonValueKind.Null);
        var reminders = root.GetProperty("reminders");
        reminders[0].GetProperty("kind").GetString().Should().Be("before");
        reminders[0].GetProperty("minutesBefore").GetInt32().Should().Be(30);
        reminders[1].GetProperty("date").GetString().Should().Be("2026-10-08");
        reminders[1].GetProperty("time").GetString().Should().Be("09:00");
        reminders[2].GetProperty("days")[0].GetString().Should().Be("Monday");
    }

    [Fact]
    public void A_task_without_a_time_has_only_a_date()
    {
        var json = ContinuedItem.Describe("task", "Pay rent", null, new DateTime(2026, 10, 9, 21, 0, 0, DateTimeKind.Utc), false,
            null, null, TaskPriority.High, [], Moscow);

        var root = JsonDocument.Parse(json).RootElement;
        root.GetProperty("date").GetString().Should().Be("2026-10-10"); // midnight local
        root.GetProperty("time").ValueKind.Should().Be(JsonValueKind.Null);
        root.GetProperty("priority").GetString().Should().Be("high");
    }

    [Theory]
    [InlineData("Bring the yellow slip and the passport.", "bring the yellow slip too", true)]
    [InlineData(null, "call the plumber back tomorrow at noon", false)]
    [InlineData("Incomplete fragment", "call the plumber back tomorrow at noon", false)]
    [InlineData("anything", "ok", true)] // nothing worth checking
    public void New_words_are_noticed_when_missing(string? details, string words, bool expected) =>
        ContinuedItem.MentionsWords(details, words).Should().Be(expected);

    [Fact]
    public void Missing_words_are_added_as_their_own_paragraph()
    {
        ContinuedItem.JoinDetails("Old text.", " New words ").Should().Be("Old text.\n\nNew words");
        ContinuedItem.JoinDetails(null, "New words").Should().Be("New words");
    }
}
