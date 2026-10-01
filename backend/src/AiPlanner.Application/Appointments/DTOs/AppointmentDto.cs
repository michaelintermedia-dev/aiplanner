using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Appointments.DTOs;

public record AppointmentParticipantDto(string Name, string? Email);

public record AppointmentDto(
    Guid Id,
    string Title,
    string? Description,
    string? Notes,
    string? AiSummary,
    DateTime StartUtc,
    DateTime EndUtc,
    string? Location,
    AppointmentStatus Status,
    IReadOnlyList<AppointmentParticipantDto> Participants,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    // Filled on single-item reads (detail view); null in lists.
    ReminderDto? Reminder = null,
    // The capture this appointment was created from.
    Guid? SourceCaptureId = null);
