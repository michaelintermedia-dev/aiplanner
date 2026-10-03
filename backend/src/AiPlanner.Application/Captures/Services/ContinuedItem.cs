using System.Globalization;
using System.Text.Json;
using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Captures.Services;

/// <summary>
/// The saved item a capture is continued from, written for the AI in the same
/// shape it answers in (local dates, its reminder kinds), so it can return the
/// whole item updated with what the user added. Pure - unit tested.
/// </summary>
public static class ContinuedItem
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = false };

    public static string Describe(
        string intent, string title, string? description, DateTime? whenUtc, bool hasTime, DateTime? endUtc,
        string? location, TaskPriority? priority, IEnumerable<ReminderDto> reminders, TimeZoneInfo zone)
    {
        string? Date(DateTime? utc) => utc is { } u ? TimeZoneInfo.ConvertTimeFromUtc(u, zone).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) : null;
        string? Time(DateTime? utc) => utc is { } u ? TimeZoneInfo.ConvertTimeFromUtc(u, zone).ToString("HH:mm", CultureInfo.InvariantCulture) : null;

        var item = new
        {
            intent,
            title,
            description,
            date = Date(whenUtc),
            time = hasTime ? Time(whenUtc) : null,
            endTime = intent == "appointment" ? Time(endUtc) : null,
            location,
            priority = priority is null or TaskPriority.None ? null : priority.Value.ToString().ToLowerInvariant(),
            reminders = reminders.Select(r => new
            {
                kind = r.Kind.ToString().ToLowerInvariant(),
                minutesBefore = r.Kind == ReminderKind.Before ? r.MinutesBefore : null,
                date = r.Kind == ReminderKind.At ? Date(r.AtUtc) : null,
                time = r.Kind == ReminderKind.At ? Time(r.AtUtc) : r.Time,
                days = r.Kind == ReminderKind.Weekly ? r.Days?.Select(d => d.ToString()).ToList() : null,
            }).ToList(),
        };
        return JsonSerializer.Serialize(item, Json);
    }
}
