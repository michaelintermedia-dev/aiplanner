using AiPlanner.Application.Common.Utils;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Recurrence;

/// <summary>
/// Pure recurrence math (unit tested): when a repeating task or event falls.
/// Everything runs on the user's wall clock - "every Monday at 09:00" stays at
/// 09:00 across daylight-saving changes - and is converted to UTC at the end.
/// The item's own start is the first occurrence.
/// </summary>
public static class RecurrenceSchedule
{
    /// <summary>How far ahead (or how many) it ever looks - a guard, not a rule.</summary>
    private const int MaxDays = 366 * 20;

    /// <summary>Every occurrence's start (UTC) in [fromUtc, toUtc), oldest first.</summary>
    public static IEnumerable<DateTime> Occurrences(RecurrenceDto rule, DateTime firstUtc, TimeZoneInfo zone, DateTime fromUtc, DateTime toUtc)
    {
        foreach (var utc in All(rule, firstUtc, zone))
        {
            if (utc >= toUtc) yield break;
            if (utc >= fromUtc) yield return utc;
        }
    }

    /// <summary>The first occurrence strictly after <paramref name="afterUtc"/>, or null when the series is over.</summary>
    public static DateTime? Next(RecurrenceDto rule, DateTime firstUtc, TimeZoneInfo zone, DateTime afterUtc)
    {
        foreach (var utc in All(rule, firstUtc, zone))
        {
            if (utc > afterUtc) return utc;
        }
        return null;
    }

    /// <summary>Every occurrence's start (UTC), oldest first, as long as the series runs.</summary>
    public static IEnumerable<DateTime> All(RecurrenceDto rule, DateTime firstUtc, TimeZoneInfo zone)
    {
        var first = TimeZoneInfo.ConvertTimeFromUtc(firstUtc, zone);
        var firstDay = DateOnly.FromDateTime(first);
        var time = TimeOnly.FromDateTime(first);
        var interval = Math.Max(1, rule.Interval);
        var days = rule.Frequency == RecurrenceFrequency.Weekly && rule.Days is { Count: > 0 } d ? d.ToHashSet() : [firstDay.DayOfWeek];
        var monthDay = rule.MonthDay ?? firstDay.Day;
        var count = 0;

        for (var i = 0; i < MaxDays; i++)
        {
            var day = firstDay.AddDays(i);
            if (rule.Until is { } until && day > until) yield break;
            // The item's own date is always the first one, even if it doesn't fit the rule.
            if (i > 0 && !Falls(rule.Frequency, interval, days, monthDay, firstDay, day)) continue;
            if (rule.Count is { } max && count >= max) yield break;
            count++;
            yield return UserTimeZoneHelper.LocalToUtc(day.ToDateTime(time), zone);
        }
    }

    private static bool Falls(RecurrenceFrequency frequency, int interval, HashSet<DayOfWeek> days, int monthDay, DateOnly first, DateOnly day) =>
        frequency switch
        {
            RecurrenceFrequency.Daily => (day.DayNumber - first.DayNumber) % interval == 0,
            RecurrenceFrequency.Weekdays => day.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday),
            RecurrenceFrequency.Weekly => days.Contains(day.DayOfWeek) && WeeksBetween(first, day) % interval == 0,
            RecurrenceFrequency.Monthly => MonthsBetween(first, day) % interval == 0
                && day.Day == Math.Min(monthDay, DateTime.DaysInMonth(day.Year, day.Month)),
            _ => false,
        };

    /// <summary>Whole weeks between the Mondays that start the two dates' weeks.</summary>
    private static int WeeksBetween(DateOnly a, DateOnly b) => (Monday(b).DayNumber - Monday(a).DayNumber) / 7;

    private static DateOnly Monday(DateOnly d) => d.AddDays(-(((int)d.DayOfWeek + 6) % 7));

    private static int MonthsBetween(DateOnly a, DateOnly b) => (b.Year - a.Year) * 12 + b.Month - a.Month;
}
