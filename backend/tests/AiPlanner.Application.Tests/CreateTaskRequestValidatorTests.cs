using AiPlanner.Application.Reminders;
using AiPlanner.Application.Tasks.DTOs;
using AiPlanner.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class CreateTaskRequestValidatorTests
{
    private readonly CreateTaskRequestValidator _validator = new();

    [Fact]
    public void Valid_request_with_due_date_and_reminder_passes()
    {
        var request = new CreateTaskRequest(
            "Finish project proposal", null, null,
            StartDateUtc: null,
            DueDateUtc: DateTime.UtcNow.AddDays(2),
            HasDueTime: true,
            Priority: TaskPriority.High,
            IsOngoing: false,
            Reminders: [new ReminderDto(ReminderKind.Before, MinutesBefore: 30)],
            Tags: new[] { "work" });

        _validator.Validate(request).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Before_reminder_without_due_time_fails()
    {
        var request = new CreateTaskRequest(
            "Some task", null, null, null, null, false, TaskPriority.None,
            IsOngoing: false, Reminders: [new ReminderDto(ReminderKind.Before, MinutesBefore: 15)], Tags: null);

        _validator.Validate(request).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Daily_reminder_without_due_date_passes()
    {
        var request = new CreateTaskRequest(
            "Take vitamins", null, null, null, null, false, TaskPriority.None,
            IsOngoing: false, Reminders: [new ReminderDto(ReminderKind.Daily, Time: "08:00")], Tags: null);

        _validator.Validate(request).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(ReminderKind.Daily, null)] // no time
    [InlineData(ReminderKind.Daily, "8am")] // not HH:mm
    [InlineData(ReminderKind.Weekly, "08:00")] // no days
    [InlineData(ReminderKind.At, null)] // no moment
    public void Incomplete_reminders_fail(ReminderKind kind, string? time)
    {
        var request = new CreateTaskRequest(
            "Something", null, null, null, null, false, TaskPriority.None,
            IsOngoing: false, Reminders: [new ReminderDto(kind, Time: time)], Tags: null);

        _validator.Validate(request).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Empty_title_fails()
    {
        var request = new CreateTaskRequest("", null, null, null, null, false, TaskPriority.None, false, null, null);
        _validator.Validate(request).IsValid.Should().BeFalse();
    }
}
