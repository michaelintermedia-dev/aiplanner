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
    ReminderDto? Reminder,
    IReadOnlyList<string>? Tags);
