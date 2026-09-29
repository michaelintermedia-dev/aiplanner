namespace AiPlanner.Application.Calendar.DTOs;

/// <summary>
/// A unified, date-anchored calendar entry - either a Task (deadline) or an
/// Appointment - so the calendar grid can render both kinds visually
/// distinguished by ItemType (spec section 12).
/// </summary>
public record CalendarItemDto(
    Guid Id,
    string ItemType, // "Task" | "Appointment"
    string Title,
    DateTime StartUtc,
    DateTime? EndUtc,
    bool HasTime,
    string Status,
    string? Priority,
    string? Location);
