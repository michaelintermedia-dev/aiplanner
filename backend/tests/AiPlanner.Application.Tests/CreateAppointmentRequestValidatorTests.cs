using AiPlanner.Application.Appointments.DTOs;
using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class CreateAppointmentRequestValidatorTests
{
    private readonly CreateAppointmentRequestValidator _validator = new();

    [Fact]
    public void Valid_request_passes()
    {
        var start = DateTime.UtcNow.AddDays(1);
        var request = new CreateAppointmentRequest(
            "Client meeting", null, null, start, start.AddHours(1), "Office", new[] { "Sarah" }, new ReminderDto(ReminderKind.Before, MinutesBefore: 15));

        _validator.Validate(request).IsValid.Should().BeTrue();
    }

    [Fact]
    public void End_before_start_fails()
    {
        var start = DateTime.UtcNow.AddDays(1);
        var request = new CreateAppointmentRequest(
            "Client meeting", null, null, start, start.AddMinutes(-30), null, null, null);

        _validator.Validate(request).IsValid.Should().BeFalse();
    }
}
