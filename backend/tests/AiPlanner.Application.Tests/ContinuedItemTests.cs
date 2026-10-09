using System.Text.Json;
using AiPlanner.Application.Ai.Services;
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

    private static readonly DateTime Friday19 = new(2026, 10, 9, 16, 0, 0, DateTimeKind.Utc);

    private static NormalizedItem Item(ExtractionIntent intent, string title, string? details, DateTime? start = null, DateTime? due = null,
        string? location = null, bool addsToCurrent = false) =>
        new(intent, title, null, details, start, start?.AddHours(1), due, start is not null || due is not null, location, null, [], null, null, null,
            AddsToCurrent: addsToCurrent);

    [Fact]
    public void A_proposal_meant_as_a_new_item_never_replaces_the_item()
    {
        var dinner = Item(ExtractionIntent.Appointment, "Dinner with Sara", "Book a table", start: Friday19, location: "Bistro");
        var stray = Item(ExtractionIntent.Task, "Ask about tickets", "Ask her about the concert tickets");

        var kept = ContinuedItem.Keep([stray], dinner, "Ask her about the concert tickets as well. Also call mom tonight.");

        kept.Intent.Should().Be(ExtractionIntent.Appointment);
        kept.Title.Should().Be("Dinner with Sara");
        kept.StartUtc.Should().Be(Friday19);
        kept.Location.Should().Be("Bistro");
        kept.Description.Should().Be("Book a table\n\nAsk her about the concert tickets as well. Also call mom tonight.");
        kept.AddsToCurrent.Should().BeTrue();
    }

    [Fact]
    public void Fields_the_update_left_out_keep_the_items_values()
    {
        var plumber = Item(ExtractionIntent.Task, "Call plumber back", "Leak under the sink", due: Friday19);
        var update = Item(ExtractionIntent.Task, "Call plumber back", "Leak under the sink. Ask about the kitchen tap", addsToCurrent: true);

        var kept = ContinuedItem.Keep([update], plumber, "Ask him about the kitchen tap as well");

        kept.DueUtc.Should().Be(Friday19);
        kept.HasTime.Should().BeTrue();
        kept.Description.Should().Be("Leak under the sink. Ask about the kitchen tap");
    }

    [Fact]
    public void Details_that_lost_the_old_text_get_both_back()
    {
        var plumber = Item(ExtractionIntent.Task, "Call plumber back", "Leak under the sink, spare key with neighbour", due: Friday19);
        var update = Item(ExtractionIntent.Task, "Call plumber back", "Ask him about the kitchen tap", due: Friday19, addsToCurrent: true);

        var kept = ContinuedItem.Keep([update], plumber, "Ask him about the kitchen tap as well");

        kept.Description.Should().Be("Leak under the sink, spare key with neighbour\n\nAsk him about the kitchen tap as well");
    }

    [Fact]
    public void An_asked_for_type_change_is_kept()
    {
        var note = Item(ExtractionIntent.Note, "Dentist", "Dentist on Friday");
        var update = Item(ExtractionIntent.Appointment, "Dentist", "Dentist on Friday", start: Friday19, addsToCurrent: true);

        var kept = ContinuedItem.Keep([update], note, "Make it an event on Friday at seven");

        kept.Intent.Should().Be(ExtractionIntent.Appointment);
        kept.StartUtc.Should().Be(Friday19);
    }

    [Fact]
    public void Unrelated_words_stay_out_of_the_details()
    {
        var plumber = Item(ExtractionIntent.Task, "Call plumber back", "Leak under the sink", due: Friday19);
        var update = Item(ExtractionIntent.Task, "Call plumber back", "Leak under the sink", due: Friday19, addsToCurrent: true)
            with { Unrelated = "Also call mom tonight." };

        var kept = ContinuedItem.Keep([update], plumber, "Ask him about the kitchen tap as well. Also call mom tonight.");

        kept.Description.Should().Be("Leak under the sink" + "\n\n" + "Ask him about the kitchen tap as well.");
        kept.Unrelated.Should().Be("Also call mom tonight.");
    }

    [Fact]
    public void Instructions_it_carried_out_are_not_copied_into_the_details()
    {
        var plumber = Item(ExtractionIntent.Task, "Call plumber back", "Leak under the sink", due: Friday19);
        var update = Item(ExtractionIntent.Task, "Call plumber back", "Leak under the sink", due: Friday19, addsToCurrent: true)
            with { Priority = TaskPriority.High, Reminders = [new ReminderDto(ReminderKind.Before, MinutesBefore: 30)] };

        var kept = ContinuedItem.Keep([update], plumber, "Make it high priority and remind me 30 minutes before.");

        kept.Description.Should().Be("Leak under the sink");
        kept.Priority.Should().Be(TaskPriority.High);
    }

    [Fact]
    public void A_date_it_is_asking_about_is_not_applied()
    {
        var dinner = Item(ExtractionIntent.Appointment, "Dinner", null, start: Friday19);
        var unsure = Item(ExtractionIntent.Appointment, "Dinner", null, start: new DateTime(2026, 10, 5, 7, 0, 0, DateTimeKind.Utc), addsToCurrent: true)
            with { Clarification = "February has no 31st - which date did you mean?" };

        var kept = ContinuedItem.Keep([unsure], dinner, "Move it to the 31st of February.");

        kept.StartUtc.Should().Be(Friday19);
        kept.Clarification.Should().NotBeNull();
        kept.Description.Should().BeNull(); // the instruction it couldn't carry out isn't kept as details
    }

    [Fact]
    public void Tags_the_update_left_out_stay_and_new_ones_come_in()
    {
        var task = Item(ExtractionIntent.Task, "Buy milk", null) with { Tags = ["shopping"] };

        var leftOut = ContinuedItem.Keep([Item(ExtractionIntent.Task, "Buy milk", null, addsToCurrent: true)], task, "two liters");
        leftOut.Tags.Should().Equal("shopping");

        var added = ContinuedItem.Keep([Item(ExtractionIntent.Task, "Buy milk", null, addsToCurrent: true) with { Tags = ["shopping", "urgent"] }], task, "tag it urgent");
        added.Tags.Should().Equal("shopping", "urgent");
        added.Description.Should().BeNull("a tag is an instruction carried out, not details");
    }

    [Fact]
    public void The_item_is_described_with_its_tags()
    {
        ContinuedItem.Describe("note", "Ideas", "x", null, false, null, null, null, [], Moscow, tags: ["work"])
            .Should().Contain("\"tags\":[\"work\"]");
    }

    [Fact]
    public void A_note_keeps_everything_said_nothing_is_split_off()
    {
        var note = Item(ExtractionIntent.Note, "Cabin wifi", "The wifi password is blue-cactus-42.");
        var words = "Also the router is in the hallway cupboard, next to the fuse box.";
        var proposal = Item(ExtractionIntent.Note, "Cabin wifi", "The wifi password is blue-cactus-42.", addsToCurrent: true) with { Unrelated = words };

        var kept = ContinuedItem.Keep([proposal], note, words);

        kept.Unrelated.Should().BeNull("more thoughts are more of the note, not a new entry");
        kept.Description.Should().Contain("blue-cactus-42").And.Contain("hallway cupboard");
    }
}
