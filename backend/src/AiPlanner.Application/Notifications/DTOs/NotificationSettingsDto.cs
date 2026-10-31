namespace AiPlanner.Application.Notifications.DTOs;

/// <summary>The notification part of the user's settings (spec section "Settings - Notifications").</summary>
/// <param name="Enabled">Master switch.</param>
/// <param name="DailySummaryTime">"HH:mm", the user's local time.</param>
/// <param name="EventReminderMinutes">The reminder every new event gets, minutes before (0 = off). Null on a PUT = unchanged (older apps don't send it).</param>
public record NotificationSettingsDto(
    bool Enabled,
    bool TaskReminders,
    bool AppointmentReminders,
    bool DailySummary,
    string DailySummaryTime,
    int? EventReminderMinutes = null);
