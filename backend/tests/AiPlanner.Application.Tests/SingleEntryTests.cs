using AiPlanner.Application.Ai.Services;
using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class SingleEntryTests
{
    private static readonly DateTime Friday10 = new(2026, 10, 9, 7, 0, 0, DateTimeKind.Utc);

    private static NormalizedItem Item(
        ExtractionIntent intent, string title, string? description = null, string? source = null,
        DateTime? start = null, DateTime? due = null, bool hasTime = false,
        IReadOnlyList<ReminderDto>? reminders = null, string? clarification = null, double? confidence = 0.9) =>
        new(intent, title, null, description, start, start?.AddHours(1), due, hasTime, null, null,
            reminders ?? [], null, clarification, confidence, SourceText: source);

    private static NormalizedExtraction Of(params NormalizedItem[] items) => new("Capture", null, items);

    [Fact]
    public void OneItem_IsLeftAsItIs()
    {
        var one = Of(Item(ExtractionIntent.Task, "Buy milk", source: "buy milk"));
        SingleEntry.Merge(one).Should().BeSameAs(one);
    }

    [Fact]
    public void Several_BecomeOne_TheEventLeads_OthersInTheUsersWords()
    {
        var merged = SingleEntry.Merge(Of(
            Item(ExtractionIntent.Note, "Wifi code", "The code is 1234", source: "the wifi code is 1234"),
            Item(ExtractionIntent.Appointment, "Dentist", "Bring the x-ray", source: "dentist Friday at 10", start: Friday10, hasTime: true),
            Item(ExtractionIntent.Task, "Buy milk", source: "and buy milk")));

        var item = merged.Items.Should().ContainSingle().Subject;
        item.Intent.Should().Be(ExtractionIntent.Appointment);
        item.Title.Should().Be("Dentist");
        item.StartUtc.Should().Be(Friday10);
        item.Description.Should().Be("Bring the x-ray\n• the wifi code is 1234\n• and buy milk");
        item.SourceText.Should().BeNull("the whole recording is its clip");
    }

    [Fact]
    public void TaskLeadsOverNote_AndTiesGoToTheFirst()
    {
        var merged = SingleEntry.Merge(Of(
            Item(ExtractionIntent.Note, "Idea"),
            Item(ExtractionIntent.Task, "Call Anna"),
            Item(ExtractionIntent.Task, "Call Ben")));
        merged.Items.Single().Title.Should().Be("Call Anna");
        merged.Items.Single().Description.Should().Be("• Idea\n• Call Ben");
    }

    [Fact]
    public void WithoutWords_TheOthersAreTitleAndDetails()
    {
        var merged = SingleEntry.Merge(Of(Item(ExtractionIntent.Task, "Main"), Item(ExtractionIntent.Note, "Parking", "Level 3")));
        merged.Items.Single().Description.Should().Be("• Parking: Level 3");
    }

    [Fact]
    public void Reminders_AreKept_AndAnotherItemsBeforeBecomesAFixedTime()
    {
        var daily = new ReminderDto(ReminderKind.Daily, Time: "08:00");
        var merged = SingleEntry.Merge(Of(
            Item(ExtractionIntent.Task, "Report", reminders: [daily]),
            Item(ExtractionIntent.Appointment, "Call", start: Friday10, hasTime: true,
                reminders: [new ReminderDto(ReminderKind.Before, MinutesBefore: 30)]),
            Item(ExtractionIntent.Note, "Undated", reminders: [new ReminderDto(ReminderKind.Before, MinutesBefore: 10)])));

        // The appointment leads, so its own "before" stays; the task's daily one comes along.
        var reminders = merged.Items.Single().Reminders;
        reminders.Should().HaveCount(2);
        reminders.Should().Contain(r => r.Kind == ReminderKind.Before && r.MinutesBefore == 30);
        reminders.Should().Contain(daily);
    }

    [Fact]
    public void BeforeOfAnotherTimedItem_IsCarriedAsAt()
    {
        var merged = SingleEntry.Merge(Of(
            Item(ExtractionIntent.Appointment, "Lunch", start: Friday10, hasTime: true),
            Item(ExtractionIntent.Task, "Send slides", due: Friday10.AddHours(2), hasTime: true,
                reminders: [new ReminderDto(ReminderKind.Before, MinutesBefore: 15)])));
        merged.Items.Single().Reminders.Should().ContainSingle()
            .Which.Should().Be(new ReminderDto(ReminderKind.At, AtUtc: Friday10.AddHours(2).AddMinutes(-15)));
    }

    [Fact]
    public void Questions_AreAllKept_AndConfidenceIsTheLowest()
    {
        var merged = SingleEntry.Merge(Of(
            Item(ExtractionIntent.Task, "A", clarification: "Which day?", confidence: 0.9),
            Item(ExtractionIntent.Task, "B", clarification: "What time?", confidence: 0.4)));
        merged.Items.Single().Clarification.Should().Be("Which day? What time?");
        merged.Items.Single().Confidence.Should().Be(0.4);
    }

    [Fact]
    public void Tags_of_every_item_are_kept_once()
    {
        var merged = SingleEntry.Merge(Of(
            Item(ExtractionIntent.Task, "Buy milk") with { Tags = ["shopping"] },
            Item(ExtractionIntent.Task, "Buy bread") with { Tags = ["Shopping", "bakery"] }));
        merged.Items.Single().Tags.Should().Equal("shopping", "bakery");
    }
}
