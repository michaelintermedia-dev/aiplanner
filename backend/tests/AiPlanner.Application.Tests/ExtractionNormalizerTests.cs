using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Ai.Services;
using AiPlanner.Application.Reminders;
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
        RawReminder? reminder = null,
        string? recurrence = null,
        string? clarification = null,
        double? confidence = 0.9,
        string? location = null) =>
        new(intent, title, null, null, date, time, endTime, location, priority, reminder is null ? null : [reminder], recurrence, clarification, confidence);

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
    public void Reminder_becomes_a_task_that_reminds_at_its_time()
    {
        var item = Normalize(Item(intent: "reminder", title: "Call John", date: "2026-10-01", time: "14:00"));

        item.Intent.Should().Be(ExtractionIntent.Task);
        item.DueUtc.Should().Be(new DateTime(2026, 10, 1, 11, 0, 0, DateTimeKind.Utc));
        item.Reminders.Should().Equal(new ReminderDto(ReminderKind.Before, MinutesBefore: 0));
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
    [InlineData("2026-09-30", "10:00")] // earlier today (now is 15:00)
    [InlineData("2026-09-29", null)] // yesterday, date only
    public void Items_resolved_into_the_past_ask_the_user_to_check(string date, string? time)
    {
        var item = Normalize(Item(intent: "reminder", date: date, time: time));

        item.Clarification.Should().Contain("already passed");
    }

    [Theory]
    [InlineData("2026-09-30", "18:00")] // later today
    [InlineData("2026-09-30", null)] // today, date only
    public void Items_later_today_are_not_flagged_as_past(string date, string? time)
    {
        var item = Normalize(Item(date: date, time: time));

        (item.Clarification ?? "").Should().NotContain("already passed");
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
    [InlineData(-5, 0)]
    [InlineData(30, 30)]
    [InlineData(999_999, 0)]
    public void Before_reminder_minutes_outside_range_fall_back_to_at_the_time(int raw, int expected)
    {
        var item = Normalize(Item(date: "2026-10-01", time: "10:00", reminder: new RawReminder("before", raw, null, null, null)));

        item.Reminders.Single().MinutesBefore.Should().Be(expected);
    }

    [Fact]
    public void Before_reminder_on_a_task_without_a_time_asks_for_one()
    {
        var item = Normalize(Item(date: "2026-10-01", reminder: new RawReminder("before", 10, null, null, null)));

        item.Reminders.Single().Kind.Should().Be(ReminderKind.Before);
        item.Clarification.Should().Contain("What time");
    }

    [Fact]
    public void Daily_reminder_keeps_its_local_time()
    {
        var item = Normalize(Item(title: "Take vitamins", reminder: new RawReminder("daily", null, null, "8:00", null)));

        item.Reminders.Should().Equal(new ReminderDto(ReminderKind.Daily, Time: "08:00"));
        item.Clarification.Should().BeNull();
    }

    [Fact]
    public void Weekly_reminder_parses_day_names()
    {
        var item = Normalize(Item(reminder: new RawReminder("weekly", null, null, "19:30", ["monday", "Thursday", "Funday"])));

        item.Reminders.Single().Kind.Should().Be(ReminderKind.Weekly);
        item.Reminders.Single().Time.Should().Be("19:30");
        item.Reminders.Single().Days.Should().Equal(DayOfWeek.Monday, DayOfWeek.Thursday);
    }

    [Theory]
    [InlineData("daily", null, null, "What time")]
    [InlineData("weekly", "09:00", null, "Which days")]
    public void Repeating_reminders_ask_for_what_is_missing(string kind, string? time, string[]? days, string question)
    {
        var item = Normalize(Item(reminder: new RawReminder(kind, null, null, time, days)));

        item.Reminders.Single().Kind.Should().NotBe(ReminderKind.At);
        item.Clarification.Should().Contain(question);
    }

    [Fact]
    public void At_reminder_with_only_a_time_means_the_next_one()
    {
        // Now is 15:00; "remind me at 16:00" is later today.
        var item = Normalize(Item(intent: "note", reminder: new RawReminder("at", null, null, "16:00", null)));

        item.Reminders.Should().Equal(new ReminderDto(ReminderKind.At, AtUtc: new DateTime(2026, 9, 30, 13, 0, 0, DateTimeKind.Utc)));
    }

    [Fact]
    public void Several_reminders_are_kept()
    {
        var raw = new RawExtractedItem("appointment", "Trip to Netanya", null, null, "2026-10-02", "17:00", null, null, null,
            [new RawReminder("at", null, "2026-10-02", "15:00", null), new RawReminder("at", null, "2026-10-02", "16:00", null)],
            null, null, 0.9);

        Normalize(raw).Reminders.Select(r => r.AtUtc).Should().Equal(
            new DateTime(2026, 10, 2, 12, 0, 0, DateTimeKind.Utc), new DateTime(2026, 10, 2, 13, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void Addition_to_the_current_item_is_marked()
    {
        var raw = new RawExtractedItem("note", "Second step detail", null, "Users drop off at the pricing page", null, null, null, null, null,
            null, null, null, 0.8, AddsToCurrent: true);

        var item = Normalize(raw);

        item.AddsToCurrent.Should().BeTrue();
        item.Description.Should().Be("Users drop off at the pricing page");
        Normalize(Item()).AddsToCurrent.Should().BeFalse();
    }

    [Fact]
    public void Unknown_reminder_kind_is_ignored()
    {
        Normalize(Item(reminder: new RawReminder("hourly", null, null, "10:00", null))).Reminders.Should().BeEmpty();
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
    public void Notes_without_a_reminder_carry_no_dates_or_locations()
    {
        var item = Normalize(Item(intent: "note", date: "2026-10-01", time: "10:00", location: "Office"));

        item.DueUtc.Should().BeNull();
        item.StartUtc.Should().BeNull();
        item.HasTime.Should().BeFalse();
        item.Location.Should().BeNull();
        item.Reminders.Should().BeEmpty();
    }

    [Fact]
    public void Note_with_a_reminder_keeps_when_to_remind()
    {
        var item = Normalize(Item(intent: "note", title: "Garden idea", reminder: new RawReminder("at", null, "2026-10-01", "09:00", null)));

        item.Intent.Should().Be(ExtractionIntent.Note);
        item.DueUtc.Should().BeNull(); // the note itself stays undated
        item.Reminders.Should().Equal(new ReminderDto(ReminderKind.At, AtUtc: new DateTime(2026, 10, 1, 6, 0, 0, DateTimeKind.Utc)));
        item.Clarification.Should().BeNull();
    }

    [Fact]
    public void Note_reminder_without_a_time_asks_when()
    {
        // "before" means nothing on a note (no time of its own): ask when instead.
        var item = Normalize(Item(intent: "note", reminder: new RawReminder("before", 0, null, null, null)));

        item.Reminders.Should().Equal(new ReminderDto(ReminderKind.At));
        item.Clarification.Should().Contain("When should I remind you");
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
    public void Our_time_question_is_not_repeated_when_the_ai_asked_it()
    {
        var item = Normalize(Item(intent: "appointment", clarification: "What time next week should I put the meeting?"));

        item.Clarification.Should().Be("What time next week should I put the meeting?");
    }

    [Fact]
    public void Our_questions_follow_the_users_language()
    {
        var raw = new RawExtraction(null, null, [Item(intent: "appointment")], "{}", "Test", "test-model");

        var item = ExtractionNormalizer.Normalize(raw, "встреча", LocalNow, Moscow, "ru-RU").Items.Single();

        item.Clarification.Should().Be("Когда это событие?");
    }

    [Theory]
    [InlineData("What's the weather like tomorrow?")]
    [InlineData("hmm, random thought about the garden")]
    public void Input_with_nothing_actionable_becomes_a_note_with_the_full_text(string input)
    {
        var raw = new RawExtraction(Title: null, Summary: null, [], "{}", "Test", "test-model");

        var result = ExtractionNormalizer.Normalize(raw, input, LocalNow, Moscow);

        var note = result.Items.Should().ContainSingle().Subject;
        note.Intent.Should().Be(ExtractionIntent.Note);
        note.Description.Should().Be(input);
        note.Title.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public void Items_the_ai_returned_are_not_replaced_by_the_note_fallback()
    {
        var raw = new RawExtraction("Plan", null, [Item(title: "Call Anna")], "{}", "Test", "test-model");

        ExtractionNormalizer.Normalize(raw, "call Anna", LocalNow, Moscow).Items.Should().ContainSingle()
            .Which.Title.Should().Be("Call Anna");
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
