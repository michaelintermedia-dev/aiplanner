namespace AiPlanner.Application.Common.Utils;

/// <summary>
/// Moving the account to another time zone (Settings - Time zone; pure, unit
/// tested). A date without a time is stored as midnight in the user's zone, so
/// it moves to the same calendar day in the new zone; anything with a time keeps
/// its real moment (a 16:00 meeting in Tel Aviv is 09:00 in New York).
/// </summary>
public static class TimeZoneMove
{
    /// <summary>Whether <paramref name="id"/> is an IANA zone this server knows ("Asia/Jerusalem", "UTC").</summary>
    public static bool IsValid(string? id) =>
        !string.IsNullOrWhiteSpace(id) && id.Length <= 100 && TimeZoneInfo.TryFindSystemTimeZoneById(id, out _);

    /// <summary>The same local day, at midnight in the new zone.</summary>
    public static DateTime AllDay(DateTime utc, TimeZoneInfo from, TimeZoneInfo to)
    {
        var day = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), from));
        return DateTime.SpecifyKind(UserTimeZoneHelper.LocalDateStartToUtc(day, to), DateTimeKind.Utc);
    }
}
