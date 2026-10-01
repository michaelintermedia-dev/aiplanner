using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Tasks.DTOs;

public record TaskItemDto(
    Guid Id,
    string Title,
    string? Description,
    string? Notes,
    string? AiSummary,
    DateTime? StartDateUtc,
    DateTime? DueDateUtc,
    bool HasDueTime,
    TaskItemStatus Status,
    TaskPriority Priority,
    DateTime? CompletedAtUtc,
    IReadOnlyList<string> Tags,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    // Filled on single-item reads (detail view); null in lists.
    IReadOnlyList<ReminderDto>? Reminders = null,
    // The capture this task was created from (open it to see the transcript/recording).
    Guid? SourceCaptureId = null);
