using AiPlanner.Application.Recurrence;
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
    IReadOnlyList<ReminderDto>? Reminders = null,
    // The capture this appointment was created from.
    Guid? SourceCaptureId = null,
    // How it repeats (null: it doesn't); StartUtc/EndUtc are the first occurrence.
    RecurrenceDto? Recurrence = null,
    // Occurrences the user skipped (their start times).
    IReadOnlyList<DateTime>? SkippedUtc = null,
    // In Calendar/Today: this row is one occurrence of a repeating event (StartUtc/EndUtc are its times).
    bool IsOccurrence = false);
