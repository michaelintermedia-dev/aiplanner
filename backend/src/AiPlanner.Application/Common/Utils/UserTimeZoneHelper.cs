namespace AiPlanner.Application.Common.Utils;

/// <summary>
/// Resolves "today"/date-range boundaries in a user's own timezone and converts
/// them back to UTC for querying - per spec section 25 ("Never hardcode date
/// assumptions" / always resolve relative dates using the user's timezone).
/// </summary>
public static class UserTimeZoneHelper
{
    /// <summary>
    /// Looks up a timezone by its IANA id (e.g. "America/New_York"), falling back
    /// to UTC if the id is missing/invalid rather than throwing - a bad stored
    /// timezone should degrade gracefully, not break every date-based endpoint.
    /// </summary>
    public static TimeZoneInfo ResolveTimeZone(string? timeZoneId)
    {
        if (string.IsNullOrWhiteSpace(timeZoneId))
        {
            return TimeZoneInfo.Utc;
        }

        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.Utc;
        }
        catch (InvalidTimeZoneException)
        {
            return TimeZoneInfo.Utc;
        }
    }

    /// <summary>Returns the UTC instant corresponding to local midnight on <paramref name="localDate"/>.</summary>
    public static DateTime LocalDateStartToUtc(DateOnly localDate, TimeZoneInfo timeZone)
    {
        var localMidnight = localDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(localMidnight, timeZone);
    }

    /// <summary>Returns the UTC instant corresponding to the end of the local day (exclusive upper bound).</summary>
    public static DateTime LocalDateEndToUtc(DateOnly localDate, TimeZoneInfo timeZone)
        => LocalDateStartToUtc(localDate.AddDays(1), timeZone);

    /// <summary>Today's date in the given timezone, based on the current instant.</summary>
    public static DateOnly TodayInTimeZone(TimeZoneInfo timeZone, DateTime utcNow)
        => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(utcNow, timeZone));

    /// <summary>
    /// The UTC instant of a local wall-clock time. A time skipped by a DST jump
    /// (e.g. 02:30 when clocks go 02:00 -> 03:00) moves forward an hour.
    /// </summary>
    public static DateTime LocalToUtc(DateTime local, TimeZoneInfo timeZone)
    {
        local = DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
        if (timeZone.IsInvalidTime(local))
        {
            local = local.AddHours(1);
        }
        return TimeZoneInfo.ConvertTimeToUtc(local, timeZone);
    }
}
