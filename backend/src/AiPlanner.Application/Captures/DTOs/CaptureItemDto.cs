using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Captures.DTOs;

/// <summary>
/// A proposed task/appointment/reminder/note. Dates are UTC: StartUtc/EndUtc
/// for appointments, DueUtc for tasks and reminders. Once saved, the Resulting*
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
    int? ReminderMinutesBefore,
    RecurrenceFrequency? Recurrence,
    string? Clarification,
    double? Confidence,
    Guid? ResultingTaskId,
    Guid? ResultingAppointmentId,
    Guid? ResultingNoteId);
