using AiPlanner.Application.Reminders;

namespace AiPlanner.Application.Appointments.DTOs;

public record CreateAppointmentRequest(
    string Title,
    string? Description,
    string? Notes,
    DateTime StartUtc,
    DateTime EndUtc,
    string? Location,
    IReadOnlyList<string>? ParticipantNames,
    /// <summary>The appointment's reminders.</summary>
    IReadOnlyList<ReminderDto>? Reminders);
