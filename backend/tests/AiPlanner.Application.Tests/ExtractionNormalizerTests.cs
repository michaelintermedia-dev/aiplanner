using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Ai.Services;
using AiPlanner.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class ExtractionNormalizerTests
{
    // Moscow is UTC+3 all year (no DST), which keeps expected UTC values simple.
    private static readonly TimeZoneInfo Moscow = TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");
    private static readonly TimeZoneInfo NewYork = TimeZoneInfo.FindSystemTimeZoneById("America/New_York");

    // Wednesday 2026-09-30 15:00 local.
    private static readonly DateTime LocalNow = new(2026, 9, 30, 15, 0, 0);

    private static RawExtractedItem Item(
        string? intent = "task",
        string? title = "Do something",
        string? date = null,
        string? time = null,
        string? endTime = null,
        string? priority = null,
        int? reminder = null,
        string? recurrence = null,
        string? clarification = null,
        double? confidence = 0.9,
        string? location = null) =>
        new(intent, title, null, null, date, time, endTime, location, priority, reminder, recurrence, clarification, confidence);

    private static NormalizedItem Normalize(RawExtractedItem raw, TimeZoneInfo? zone = null) =>
        ExtractionNormalizer.NormalizeItem(raw, LocalNow, zone ?? Moscow)!;

    [Fact]
    public void Task_with_date_only_is_due_at_local_midnight_without_time()
    {
        var item = Normalize(Item(date: "2026-10-01"));

        item.Intent.Should().Be(ExtractionIntent.Task);
        item.DueUtc.Should().Be(new DateTime(2026, 9, 30, 21, 0, 0, DateTimeKind.Utc));
        item.HasTime.Should().BeFalse();
        item.Clarification.Should().BeNull();
    }

    [Fact]
    public void Appointment_local_time_is_converted_to_utc_with_default_one_hour_length()
    {
        var item = Normalize(Item(intent: "appointment", title: "Meet Sarah", date: "2026-10-05", time: "10:00"));

        item.StartUtc.Should().Be(new DateTime(2026, 10, 5, 7, 0, 0, DateTimeKind.Utc));
        item.EndUtc.Should().Be(new DateTime(2026, 10, 5, 8, 0, 0, DateTimeKind.Utc));
        item.HasTime.Should().BeTrue();
        item.DueUtc.Should().BeNull();
    }

    [Fact]
    public void Appointment_ending_after_midnight_ends_the_next_day()
    {
        var item = Normalize(Item(intent: "appointment", date: "2026-10-05", time: "22:00", endTime: "01:00"));

        item.EndUtc.Should().Be(new DateTime(2026, 10, 5, 22, 0, 0, DateTimeKind.Utc)); // 01:00 on the 6th, Moscow
    }

    [Fact]
    public void Appointment_with_nonsensical_end_time_falls_back_to_one_hour()
    {
        var item = Normalize(Item(intent: "appointment", date: "2026-10-05", time: "10:00", endTime: "09:00"));

        (item.EndUtc - item.StartUtc).Should().Be(TimeSpan.FromHours(1));
    }

    [Fact]
    public void Appointment_without_time_asks_for_it()
    {
        var item = Normalize(Item(intent: "appointment", date: "2026-10-05"));

        item.HasTime.Should().BeFalse();
        item.StartUtc.Should().Be(new DateTime(2026, 10, 4, 21, 0, 0, DateTimeKind.Utc));
        item.Clarification.Should().Contain("What time");
    }

    [Fact]
    public void Appointment_without_date_or_time_has_no_start_and_asks_when()
    {
        var item = Normalize(Item(intent: "appointment"));

        item.StartUtc.Should().BeNull();
        item.Clarification.Should().Contain("When");
    }

    [Fact]
    public void Reminder_defaults_to_firing_at_its_time()
    {
        var item = Normalize(Item(intent: "reminder", title: "Call John", date: "2026-10-01", time: "14:00"));

        item.DueUtc.Should().Be(new DateTime(2026, 10, 1, 11, 0, 0, DateTimeKind.Utc));
        item.ReminderMinutesBefore.Should().Be(0);
        item.Clarification.Should().BeNull();
    }

    [Fact]
    public void Reminder_without_time_asks_for_one()
    {
        var item = Normalize(Item(intent: "reminder", date: "2026-10-01"));

        item.HasTime.Should().BeFalse();
        item.Clarification.Should().Contain("remind");
    }

    [Theory]
    [InlineData("16:00", "2026-09-30")] // later today
    [InlineData("14:00", "2026-10-01")] // already passed today -> tomorrow
    public void Time_without_date_means_the_next_occurrence(string time, string expectedLocalDate)
    {
        var item = Normalize(Item(intent: "reminder", time: time));

        var local = TimeZoneInfo.ConvertTimeFromUtc(item.DueUtc!.Value, Moscow);
        DateOnly.FromDateTime(local).ToString("yyyy-MM-dd").Should().Be(expectedLocalDate);
    }

    [Theory]
    [InlineData("next thursday")]
    [InlineData("2026-13-45")]
    [InlineData("31/10/2026")]
    public void Unparseable_date_is_dropped_with_a_clarification(string date)
    {
        var item = Normalize(Item(date: date));

        item.DueUtc.Should().BeNull();
        item.Clarification.Should().Contain("check the date");
    }

    [Theory]
    [InlineData("2035-01-01")]
    [InlineData("2020-01-01")]
    public void Implausibly_distant_dates_are_rejected(string date)
    {
        var item = Normalize(Item(date: date));

        item.DueUtc.Should().BeNull();
        item.Clarification.Should().NotBeNull();
    }

    [Fact]
    public void Time_skipped_by_a_dst_jump_moves_forward()
    {
        // 2027-03-14 02:30 doesn't exist in New York (clocks jump 02:00 -> 03:00 EDT).
        var item = Normalize(Item(intent: "appointment", date: "2027-03-14", time: "02:30"), NewYork);

        item.StartUtc.Should().Be(new DateTime(2027, 3, 14, 7, 30, 0, DateTimeKind.Utc)); // 03:30 EDT
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData("", "   ")]
    public void Item_without_a_title_is_dropped(string? intent, string? title)
    {
        ExtractionNormalizer.NormalizeItem(Item(intent: intent, title: title), LocalNow, Moscow).Should().BeNull();
    }

    [Fact]
    public void Unknown_intent_becomes_a_task()
    {
        Normalize(Item(intent: "meeting-ish")).Intent.Should().Be(ExtractionIntent.Task);
    }

    [Theory]
    [InlineData("HIGH", TaskPriority.High)]
    [InlineData("low", TaskPriority.Low)]
    [InlineData("none", null)]
    [InlineData("urgent!!", null)]
    [InlineData(null, null)]
    public void Priority_is_parsed_strictly(string? raw, TaskPriority? expected)
    {
        Normalize(Item(priority: raw)).Priority.Should().Be(expected);
    }

    [Theory]
    [InlineData(-5, null)]
    [InlineData(30, 30)]
    [InlineData(999_999, null)]
    public void Reminder_minutes_outside_range_are_dropped(int raw, int? expected)
    {
        Normalize(Item(date: "2026-10-01", reminder: raw)).ReminderMinutesBefore.Should().Be(expected);
    }

    [Theory]
    [InlineData(1.7, 1.0)]
    [InlineData(-0.2, 0.0)]
    [InlineData(double.NaN, null)]
    public void Confidence_is_clamped(double raw, double? expected)
    {
        Normalize(Item(confidence: raw)).Confidence.Should().Be(expected);
    }

    [Fact]
    public void Notes_carry_no_dates_locations_or_reminders()
    {
        var item = Normalize(Item(intent: "note", date: "2026-10-01", time: "10:00", reminder: 15, location: "Office"));

        item.DueUtc.Should().BeNull();
        item.StartUtc.Should().BeNull();
        item.Location.Should().BeNull();
        item.ReminderMinutesBefore.Should().BeNull();
    }

    [Fact]
    public void Long_titles_are_truncated_and_whitespace_collapsed()
    {
        var item = Normalize(Item(title: "  Buy\n  milk   " + new string('x', 300)));

        item.Title.Should().StartWith("Buy milk x");
        item.Title.Length.Should().Be(ExtractionNormalizer.MaxTitleLength);
    }

    [Fact]
    public void Provider_clarification_is_kept_alongside_our_own()
    {
        var item = Normalize(Item(intent: "appointment", clarification: "Which Sarah?"));

        item.Clarification.Should().Contain("Which Sarah?").And.Contain("When");
    }

    [Fact]
    public void Capture_title_falls_back_to_first_item_and_items_are_capped()
    {
        var items = Enumerable.Range(1, 30).Select(i => Item(title: $"Item {i}")).ToList();
        var raw = new RawExtraction(Title: " ", Summary: null, items, "{}", "Test", "test-model");

        var result = ExtractionNormalizer.Normalize(raw, "input", LocalNow, Moscow);

        result.Title.Should().Be("Item 1");
        result.Items.Should().HaveCount(ExtractionNormalizer.MaxItems);
    }
}
