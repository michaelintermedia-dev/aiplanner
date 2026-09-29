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
            ReminderMinutesBeforeDue: 30,
            Tags: new[] { "work" });

        _validator.Validate(request).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Reminder_without_due_date_fails()
    {
        var request = new CreateTaskRequest(
            "Some task", null, null, null, null, false, TaskPriority.None,
            IsOngoing: false, ReminderMinutesBeforeDue: 15, Tags: null);

        _validator.Validate(request).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Empty_title_fails()
    {
        var request = new CreateTaskRequest("", null, null, null, null, false, TaskPriority.None, false, null, null);
        _validator.Validate(request).IsValid.Should().BeFalse();
    }
}
