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
    DateTime UpdatedAtUtc);
