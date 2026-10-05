using AiPlanner.Domain.Entities;

namespace AiPlanner.Application.Recurrence;

/// <summary>
/// A (possibly repeating) event's occurrences: the event itself, or every
/// time its rule falls, each as long as the event, without the skipped ones.
/// Pure - used by Calendar, Today, the feed and notifications alike.
/// </summary>
public static class EventOccurrences
{
    /// <summary>Occurrences overlapping [fromUtc, toUtc) - (start, end) pairs, oldest first.</summary>
    public static IEnumerable<(DateTime Start, DateTime End)> In(Appointment a, TimeZoneInfo zone, DateTime fromUtc, DateTime toUtc)
    {
        var length = a.EndUtc - a.StartUtc;
        if (RecurrencePlanner.ToDto(a.RecurrenceRule) is not { } rule)
        {
            if (a.StartUtc < toUtc && a.EndUtc > fromUtc) yield return (a.StartUtc, a.EndUtc);
            yield break;
        }
        // Start early enough to catch one that began before the range and is still going.
        foreach (var start in RecurrenceSchedule.Occurrences(rule, a.StartUtc, zone, fromUtc - length, toUtc))
        {
            if (start + length > fromUtc && !a.SkippedOccurrencesUtc.Contains(start)) yield return (start, start + length);
        }
    }

    /// <summary>The first occurrence that hasn't ended by <paramref name="nowUtc"/> (null: all over).</summary>
    public static (DateTime Start, DateTime End)? Next(Appointment a, TimeZoneInfo zone, DateTime nowUtc)
    {
        var length = a.EndUtc - a.StartUtc;
        if (RecurrencePlanner.ToDto(a.RecurrenceRule) is not { } rule) return a.EndUtc > nowUtc ? (a.StartUtc, a.EndUtc) : null;
        foreach (var start in RecurrenceSchedule.All(rule, a.StartUtc, zone))
        {
            if (start + length > nowUtc && !a.SkippedOccurrencesUtc.Contains(start)) return (start, start + length);
        }
        return null;
    }

    /// <summary>Whether <paramref name="startUtc"/> is one of the event's occurrences (skipped or not).</summary>
    public static bool IsOccurrence(Appointment a, TimeZoneInfo zone, DateTime startUtc) =>
        RecurrencePlanner.ToDto(a.RecurrenceRule) is { } rule
            ? RecurrenceSchedule.Occurrences(rule, a.StartUtc, zone, startUtc, startUtc.AddTicks(1)).Any()
            : a.StartUtc == startUtc;
}
