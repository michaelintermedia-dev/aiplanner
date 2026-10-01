using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Captures.DTOs;

/// <summary>
/// A proposed task/appointment/note. Dates are UTC: StartUtc/EndUtc for
/// appointments, DueUtc for tasks. Any of them can carry reminders. Once saved, the Resulting*
/// id points at the real item.
/// </summary>
public record CaptureItemDto(
    Guid Id,
    ExtractionIntent Intent,
    ExtractionStatus Status,
    string Title,
    string? Summary,
    string? Description,
    DateTime? StartUtc,
    DateTime? EndUtc,
    DateTime? DueUtc,
    bool HasTime,
    string? Location,
    TaskPriority? Priority,
    IReadOnlyList<ReminderDto> Reminders,
    RecurrenceFrequency? Recurrence,
    string? Clarification,
    double? Confidence,
    Guid? ResultingTaskId,
    Guid? ResultingAppointmentId,
    Guid? ResultingNoteId);
