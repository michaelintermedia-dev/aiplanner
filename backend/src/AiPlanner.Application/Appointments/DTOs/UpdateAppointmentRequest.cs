namespace AiPlanner.Application.Appointments.DTOs;

public record UpdateAppointmentRequest(
    string Title,
    string? Description,
    string? Notes,
    DateTime StartUtc,
    DateTime EndUtc,
    string? Location,
    IReadOnlyList<string>? ParticipantNames,
    int? ReminderMinutesBeforeStart);
