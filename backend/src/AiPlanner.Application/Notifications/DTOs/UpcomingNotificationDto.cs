namespace AiPlanner.Application.Notifications.DTOs;

/// <summary>
/// One notification the client should show at AtUtc (spec sections 22-23: the
/// backend owns the scheduling rules, clients deliver). Key is stable for the
/// same occurrence, so clients can de-duplicate and reschedule safely.
/// </summary>
/// <param name="Kind">"Reminder", "Snoozed" or "DailySummary".</param>
/// <param name="ItemType">"Task", "Appointment" or "Note" (null for the daily summary).</param>
/// <param name="CanComplete">An open task - offer a "Done" action.</param>
public record UpcomingNotificationDto(
    string Key,
    string Kind,
    DateTime AtUtc,
    string Title,
    string? Body,
    string? ItemType,
    Guid? ItemId,
    bool CanComplete);
