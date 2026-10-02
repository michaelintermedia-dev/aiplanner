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

    /// <summary>The line under the title, e.g. "Starts in 30 minutes" or "Due now" (in <paramref name="t"/>'s language; English by default).</summary>
    public static string ReminderBody(Reminder r, string itemType, DateTime? itemTimeUtc, DateTime atUtc, TimeZoneInfo zone, NotificationTexts? t = null)
    {
        t ??= NotificationTexts.English;
        if (r.Kind == ReminderKind.Before && r.MinutesBefore is { } m)
        {
            return itemType == "Appointment"
                ? m == 0 ? t.StartingNow : t.StartsIn(Humanize(m, t))
                : m == 0 ? t.DueNow : t.DueIn(Humanize(m, t));
        }
        if (itemTimeUtc is { } item)
        {
            var local = TimeZoneInfo.ConvertTimeFromUtc(item, zone);
            var sameDay = local.Date == TimeZoneInfo.ConvertTimeFromUtc(atUtc, zone).Date;
            var when = sameDay
                ? local.ToString("HH:mm", CultureInfo.InvariantCulture)
                : local.ToString("ddd d MMM, HH:mm", t.Culture);
            return itemType == "Appointment" ? t.StartsAt(when) : t.DueAt(when);
        }
        return itemType switch
        {
            "Appointment" => t.EventReminder,
            "Note" => t.NoteReminder,
            _ => t.TaskReminder,
        };
    }

    /// <summary>"3 tasks due today · 1 overdue · 2 events", or null when there's nothing to say.</summary>
    public static string? DailySummary(int tasksDue, int important, int overdue, int events, NotificationTexts? t = null)
    {
        t ??= NotificationTexts.English;
        var parts = new List<string>();
        if (tasksDue > 0)
        {
            parts.Add(t.TasksDueToday(tasksDue) + (important > 0 ? t.Important(important) : ""));
        }
        if (overdue > 0)
        {
            parts.Add(t.Overdue(overdue));
        }
        if (events > 0)
        {
            parts.Add(t.Events(events));
        }
        return parts.Count == 0 ? null : string.Join(" · ", parts);
    }

    public static string Humanize(int minutes, NotificationTexts? t = null)
    {
        t ??= NotificationTexts.English;
        return minutes switch
        {
            < 60 => t.Minutes(minutes),
            _ when minutes % 1440 == 0 => t.Days(minutes / 1440),
            _ when minutes % 60 == 0 => t.Hours(minutes / 60),
            _ => t.HoursMinutes(minutes / 60, minutes % 60),
        };
    }

    public static string Snippet(string text, int max = 140)
    {
        var collapsed = string.Join(' ', text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return collapsed.Length <= max ? collapsed : collapsed[..(max - 1)].TrimEnd() + "…";
    }
}
