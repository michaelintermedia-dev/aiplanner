namespace AiPlanner.Application.Settings.DTOs;

/// <summary>Settings - Calendar. Kept on the account, so every device follows.</summary>
/// <param name="FirstDayOfWeek">"Monday", "Sunday" or "Saturday": where weeks begin.</param>
public record CalendarSettingsDto(string FirstDayOfWeek)
{
    public static readonly string[] FirstDays = ["Monday", "Sunday", "Saturday"];

    /// <summary>The stored value as a day (unknown values read as Monday).</summary>
    public static DayOfWeek ToDay(string? stored) => stored switch
    {
        "Sunday" => DayOfWeek.Sunday,
        "Saturday" => DayOfWeek.Saturday,
        _ => DayOfWeek.Monday,
    };
}
