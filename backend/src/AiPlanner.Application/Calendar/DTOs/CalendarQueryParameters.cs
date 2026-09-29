namespace AiPlanner.Application.Calendar.DTOs;

/// <summary>
/// Either View+AnchorDate (the calendar computes the range in the user's own
/// timezone, per spec section 25) or an explicit FromUtc/ToUtc override.
/// </summary>
public record CalendarQueryParameters(
    CalendarView? View,
    DateOnly? AnchorDate,
    DateTime? FromUtc,
    DateTime? ToUtc);
