namespace AiPlanner.Application.Appointments.DTOs;

public record CreateAppointmentRequest(
    string Title,
    string? Description,
    string? Notes,
    DateTime StartUtc,
    DateTime EndUtc,
    string? Location,
    IReadOnlyList<string>? ParticipantNames,
    /// <summary>Minutes before StartUtc to create a Reminder (spec section 22 - "basic reminders").</summary>
    int? ReminderMinutesBeforeStart);
