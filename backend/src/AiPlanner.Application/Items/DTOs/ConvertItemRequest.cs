namespace AiPlanner.Application.Items.DTOs;

/// <summary>
/// Change an item's type (task / event / note). FromType/ToType are "Task",
/// "Appointment" or "Note". The optional dates override what's carried over:
/// StartUtc/EndUtc for an event, DueUtc/HasDueTime for a task.
/// </summary>
public record ConvertItemRequest(
    string FromType,
    Guid Id,
    string ToType,
    DateTime? StartUtc = null,
    DateTime? EndUtc = null,
    DateTime? DueUtc = null,
    bool? HasDueTime = null);
