using AiPlanner.Application.Recurrence;
using AiPlanner.Application.Reminders;

namespace AiPlanner.Application.Appointments.DTOs;

public record UpdateAppointmentRequest(
    string Title,
    string? Description,
    string? Notes,
    DateTime StartUtc,
    DateTime EndUtc,
    string? Location,
    IReadOnlyList<string>? ParticipantNames,
    IReadOnlyList<ReminderDto>? Reminders,
    RecurrenceDto? Recurrence = null,
    /// <summary>Its tags (null: unchanged; [] clears them).</summary>
    IReadOnlyList<string>? Tags = null);
