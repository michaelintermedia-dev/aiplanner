using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Tasks.DTOs;

public record CreateTaskRequest(
    string Title,
    string? Description,
    string? Notes,
    DateTime? StartDateUtc,
    DateTime? DueDateUtc,
    bool HasDueTime,
    TaskPriority Priority,
    /// <summary>
    /// Open-ended work with no deadline (spec section 10, e.g. "Work on the new
    /// website"). When true the task is created as Ongoing regardless of dates;
    /// otherwise it's Planned (if a due date is given) or Inbox.
    /// </summary>
    bool IsOngoing,
    /// <summary>The task's reminders (a "before" one needs DueDateUtc with a time).</summary>
    IReadOnlyList<ReminderDto>? Reminders,
    IReadOnlyList<string>? Tags);
