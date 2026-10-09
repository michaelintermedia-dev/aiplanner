using AiPlanner.Application.Recurrence;
using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Tasks.DTOs;

public record UpdateTaskRequest(
    string Title,
    string? Description,
    string? Notes,
    DateTime? StartDateUtc,
    DateTime? DueDateUtc,
    bool HasDueTime,
    TaskPriority Priority,
    bool IsOngoing,
    IReadOnlyList<ReminderDto>? Reminders,
    IReadOnlyList<string>? Tags,
    RecurrenceDto? Recurrence = null,
    /// <summary>Null: unchanged; "" clears it.</summary>
    string? Location = null,
    /// <summary>Null: unchanged; [] clears them.</summary>
    IReadOnlyList<string>? People = null);
