using System.Globalization;
using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Common.Utils;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Ai.Services;

/// <summary>A proposed item after validation, with dates converted to UTC.</summary>
public record NormalizedItem(
    ExtractionIntent Intent,
    string Title,
    string? Summary,
    string? Description,
    DateTime? StartUtc, // appointment start
    DateTime? EndUtc, // appointment end
    DateTime? DueUtc, // task due date, or when a reminder fires
    bool HasTime,
    string? Location,
    TaskPriority? Priority,
    int? ReminderMinutesBefore,
    RecurrenceFrequency? Recurrence,
    string? Clarification,
    double? Confidence);

public record NormalizedExtraction(string Title, string? Summary, IReadOnlyList<NormalizedItem> Items);

/// <summary>
/// Validates provider output before anything is stored or shown (spec section
/// 17: "Do not blindly trust AI output"). Every field is parsed defensively;
/// anything unusable is dropped and turned into a clarification for the user
/// rather than guessed. Wall-clock dates are converted to UTC here using the
/// user's timezone - the provider never does timezone math.
/// </summary>
public static class ExtractionNormalizer
{
    public const int MaxItems = 20;
    public const int MaxTitleLength = 200;
    public const int MaxReminderMinutes = 30 * 24 * 60;
    private static readonly TimeSpan DefaultAppointmentLength = TimeSpan.FromHours(1);

    public static NormalizedExtraction Normalize(RawExtraction raw, string inputText, DateTime localNow, TimeZoneInfo timeZone)
    {
        var items = raw.Items
            .Take(MaxItems)
            .Select(item => NormalizeItem(item, localNow, timeZone))
            .OfType<NormalizedItem>()
            .ToList();

        var title = Clean(raw.Title, MaxTitleLength)
            ?? items.FirstOrDefault()?.Title
            ?? Clean(inputText, 60)
            ?? "Capture";

        return new NormalizedExtraction(title, Clean(raw.Summary, 2000), items);
    }

    public static NormalizedItem? NormalizeItem(RawExtractedItem raw, DateTime localNow, TimeZoneInfo timeZone)
    {
        var title = Clean(raw.Title, MaxTitleLength);
        if (title is null)
        {
            return null; // Nothing actionable without a title.
        }

        var intent = ParseIntent(raw.Intent);
        var questions = new List<string>();
        if (Clean(raw.Clarification, 500) is { } fromProvider)
        {
            questions.Add(fromProvider);
        }

        var date = ParseDate(raw.Date, localNow, questions);
        var time = ParseTime(raw.Time);
        var endTime = ParseTime(raw.EndTime);

        // "At 3pm" with no date means the next 3pm.
        if (date is null && time is not null && intent != ExtractionIntent.Note)
        {
            var today = DateOnly.FromDateTime(localNow);
            date = today.ToDateTime(time.Value) > localNow ? today : today.AddDays(1);
        }

        DateTime? startUtc = null, endUtc = null, dueUtc = null;
        var hasTime = false;

        switch (intent)
        {
            case ExtractionIntent.Appointment:
                if (date is null)
                {
                    questions.Add("When is this appointment?");
                }
                else if (time is null)
                {
                    questions.Add("What time does it start?");
                    startUtc = UserTimeZoneHelper.LocalDateStartToUtc(date.Value, timeZone);
                }
                else
                {
                    hasTime = true;
                    startUtc = ToUtc(date.Value, time.Value, timeZone);
                    endUtc = endTime is null ? startUtc + DefaultAppointmentLength : ToUtc(date.Value, endTime.Value, timeZone);
                    if (endUtc <= startUtc)
                    {
                        // "10pm to 1am" crosses midnight; anything else is a bad end time.
                        var nextDay = endTime is null ? null : (DateTime?)ToUtc(date.Value.AddDays(1), endTime.Value, timeZone);
                        endUtc = nextDay is { } nd && nd - startUtc <= TimeSpan.FromHours(12) ? nd : startUtc + DefaultAppointmentLength;
                    }
                }
                break;

            case ExtractionIntent.Task:
            case ExtractionIntent.Reminder:
                if (date is not null)
                {
                    hasTime = time is not null;
                    dueUtc = time is null
                        ? UserTimeZoneHelper.LocalDateStartToUtc(date.Value, timeZone)
                        : ToUtc(date.Value, time.Value, timeZone);
                }
                if (intent == ExtractionIntent.Reminder && !hasTime)
                {
                    questions.Add("What time should I remind you?");
                }
                break;
        }

        var reminder = raw.ReminderMinutesBefore is >= 0 and <= MaxReminderMinutes ? raw.ReminderMinutesBefore : null;
        if (intent == ExtractionIntent.Reminder)
        {
            reminder ??= 0; // A reminder fires at the time itself unless told otherwise.
        }

        return new NormalizedItem(
            intent,
            title,
            Clean(raw.Summary, 2000),
            Clean(raw.Description, 4000),
            startUtc,
            endUtc,
            dueUtc,
            hasTime,
            intent == ExtractionIntent.Note ? null : Clean(raw.Location, 300),
            ParsePriority(raw.Priority),
            intent == ExtractionIntent.Note ? null : reminder,
            ParseRecurrence(raw.Recurrence),
            questions.Count > 0 ? Truncate(string.Join(" ", questions.Distinct()), 500) : null,
            raw.Confidence is { } c && double.IsFinite(c) ? Math.Clamp(c, 0, 1) : null);
    }

    private static ExtractionIntent ParseIntent(string? value) =>
        Enum.TryParse<ExtractionIntent>(value?.Trim(), ignoreCase: true, out var intent) && Enum.IsDefined(intent)
            ? intent
            : ExtractionIntent.Task;

    private static DateOnly? ParseDate(string? value, DateTime localNow, List<string> questions)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }
        if (!DateOnly.TryParseExact(value.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
        {
            questions.Add("Please check the date.");
            return null;
        }
        // A planner item years away (or long past) is almost certainly a misread.
        var today = DateOnly.FromDateTime(localNow);
        if (date < today.AddYears(-1) || date > today.AddYears(5))
        {
            questions.Add("Please check the date.");
            return null;
        }
        return date;
    }

    private static TimeOnly? ParseTime(string? value) =>
        !string.IsNullOrWhiteSpace(value)
        && TimeOnly.TryParseExact(value.Trim(), ["HH:mm", "H:mm", "HH:mm:ss"], CultureInfo.InvariantCulture, DateTimeStyles.None, out var time)
            ? time
            : null;

    private static TaskPriority? ParsePriority(string? value) =>
        Enum.TryParse<TaskPriority>(value?.Trim(), ignoreCase: true, out var p) && Enum.IsDefined(p) && p != TaskPriority.None
            ? p
            : null;

    private static RecurrenceFrequency? ParseRecurrence(string? value) =>
        Enum.TryParse<RecurrenceFrequency>(value?.Trim(), ignoreCase: true, out var r) && Enum.IsDefined(r) && r != RecurrenceFrequency.None
            ? r
            : null;

    /// <summary>
    /// Wall-clock time in the user's zone to UTC. A time that doesn't exist
    /// (skipped by a DST jump) is moved forward by the size of the jump.
    /// </summary>
    private static DateTime ToUtc(DateOnly date, TimeOnly time, TimeZoneInfo timeZone)
    {
        var local = DateTime.SpecifyKind(date.ToDateTime(time), DateTimeKind.Unspecified);
        if (timeZone.IsInvalidTime(local))
        {
            local = local.AddHours(1);
        }
        return TimeZoneInfo.ConvertTimeToUtc(local, timeZone);
    }

    private static string? Clean(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }
        var collapsed = string.Join(' ', value.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return Truncate(collapsed, maxLength);
    }

    private static string Truncate(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..(maxLength - 1)].TrimEnd() + "…";
}
