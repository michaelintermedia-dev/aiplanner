using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Tasks.DTOs;

/// <summary>Query-string filters for GET /api/tasks. All optional.</summary>
public record TaskQueryParameters(
    TaskItemStatus? Status,
    TaskPriority? Priority,
    string? Tag,
    DateTime? DueFromUtc,
    DateTime? DueToUtc,
    bool IncludeCompleted = false);
