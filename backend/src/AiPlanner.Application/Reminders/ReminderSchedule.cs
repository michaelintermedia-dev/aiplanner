using System.Globalization;
using AiPlanner.Application.Common.Utils;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Reminders;

/// <summary>Pure reminder time math (unit tested): when does a reminder next go off?</summary>
public static class ReminderSchedule
{
    public static bool Repeats(ReminderKind kind) => kind is ReminderKind.Daily or ReminderKind.Weekdays or ReminderKind.Weekly;

    public static TimeOnly? ParseTime(string? value) =>
        TimeOnly.TryParseExact(value?.Trim(), "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var t) ? t : null;

    public static string FormatTime(TimeOnly time) => time.ToString("HH:mm", CultureInfo.InvariantCulture);

    public static int DaysMask(IEnumerable<DayOfWeek>? days) => (days ?? []).Aggregate(0, (mask, d) => mask | (1 << (int)d));

    public static IReadOnlyList<DayOfWeek> DaysFromMask(int mask) =>
        Enum.GetValues<DayOfWeek>().Where(d => (mask & (1 << (int)d)) != 0).ToList();

    /// <summary>
    /// The next time the reminder goes off, or null when it can't be scheduled
    /// (Before on an item without a time, a repeating reminder without a time).
    /// A one-off time in the past is returned as is - the caller decides.
    /// </summary>
    public static DateTime? NextUtc(
        ReminderKind kind, DateTime? atUtc, int? minutesBefore, TimeOnly? time, int daysMask,
        DateTime? itemTimeUtc, DateTime nowUtc, TimeZoneInfo zone)
    {
        switch (kind)
        {
            case ReminderKind.At:
                return atUtc;
            case ReminderKind.Before:
                return itemTimeUtc is { } item && minutesBefore is { } m ? item.AddMinutes(-m) : null;
        }

        if (time is null)
        {
            return null;
        }
        var allowed = kind switch
        {
            ReminderKind.Daily => 0b111_1111,
            ReminderKind.Weekdays => DaysMask([DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday]),
            _ => daysMask,
        };
        if (allowed == 0)
        {
            return null;
        }

        var localToday = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(nowUtc, zone));
        for (var i = 0; i <= 7; i++)
        {
            var day = localToday.AddDays(i);
            if ((allowed & (1 << (int)day.DayOfWeek)) == 0)
            {
                continue;
            }
            var utc = UserTimeZoneHelper.LocalToUtc(day.ToDateTime(time.Value), zone);
            if (utc > nowUtc)
            {
                return utc;
            }
        }
        return null;
    }
}
