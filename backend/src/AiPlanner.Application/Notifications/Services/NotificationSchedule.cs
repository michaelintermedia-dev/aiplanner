using System.Globalization;
using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Entities;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Notifications.Services;

/// <summary>Pure notification rules (unit tested): when reminders go off, and what they say.</summary>
public static class NotificationSchedule
{
    /// <summary>Every time <paramref name="r"/> goes off in [fromUtc, toUtc).</summary>
    public static IEnumerable<DateTime> Occurrences(Reminder r, DateTime fromUtc, DateTime toUtc, TimeZoneInfo zone)
    {
        if (r.IsCancelled)
        {
            yield break;
        }
        if (!ReminderSchedule.Repeats(r.Kind))
        {
            if (r.TriggerAtUtc >= fromUtc && r.TriggerAtUtc < toUtc)
            {
                yield return r.TriggerAtUtc;
            }
            yield break;
        }

        // NextUtc is strictly after its "now", so start just before the window.
        var cursor = fromUtc.AddTicks(-1);
        for (var guard = 0; guard < 400; guard++)
        {
            var next = ReminderSchedule.NextUtc(r.Kind, null, null, r.TimeOfDay, r.DaysOfWeek, null, cursor, zone);
            if (next is null || next >= toUtc)
            {
                yield break;
            }
            yield return next.Value;
            cursor = next.Value;
        }
    }

    /// <summary>The line under the title, e.g. "Starts in 30 minutes" or "Due now".</summary>
    public static string ReminderBody(Reminder r, string itemType, DateTime? itemTimeUtc, DateTime atUtc, TimeZoneInfo zone)
    {
        if (r.Kind == ReminderKind.Before && r.MinutesBefore is { } m)
        {
            return itemType == "Appointment"
                ? m == 0 ? "Starting now" : $"Starts in {Humanize(m)}"
                : m == 0 ? "Due now" : $"Due in {Humanize(m)}";
        }
        if (itemTimeUtc is { } item)
        {
            var local = TimeZoneInfo.ConvertTimeFromUtc(item, zone);
            var sameDay = local.Date == TimeZoneInfo.ConvertTimeFromUtc(atUtc, zone).Date;
            var when = sameDay
                ? local.ToString("HH:mm", CultureInfo.InvariantCulture)
                : local.ToString("ddd d MMM, HH:mm", CultureInfo.InvariantCulture);
            return itemType == "Appointment" ? $"Starts at {when}" : $"Due {when}";
        }
        return itemType switch
        {
            "Appointment" => "Event reminder",
            "Note" => "Note reminder",
            _ => "Task reminder",
        };
    }

    /// <summary>"3 tasks due today · 1 overdue · 2 events", or null when there's nothing to say.</summary>
    public static string? DailySummary(int tasksDue, int important, int overdue, int events)
    {
        var parts = new List<string>();
        if (tasksDue > 0)
        {
            parts.Add($"{tasksDue} {(tasksDue == 1 ? "task" : "tasks")} due today" + (important > 0 ? $" ({important} important)" : ""));
        }
        if (overdue > 0)
        {
            parts.Add($"{overdue} overdue");
        }
        if (events > 0)
        {
            parts.Add($"{events} {(events == 1 ? "event" : "events")}");
        }
        return parts.Count == 0 ? null : string.Join(" · ", parts);
    }

    public static string Humanize(int minutes) => minutes switch
    {
        < 60 => $"{minutes} {(minutes == 1 ? "minute" : "minutes")}",
        _ when minutes % 1440 == 0 => minutes == 1440 ? "1 day" : $"{minutes / 1440} days",
        _ when minutes % 60 == 0 => minutes == 60 ? "1 hour" : $"{minutes / 60} hours",
        _ => $"{minutes / 60} h {minutes % 60} min",
    };

    public static string Snippet(string text, int max = 140)
    {
        var collapsed = string.Join(' ', text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return collapsed.Length <= max ? collapsed : collapsed[..(max - 1)].TrimEnd() + "…";
    }
}
