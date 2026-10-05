using AiPlanner.Application.Recurrence;
using System.Globalization;
using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Reminders;
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
    DateTime? DueUtc, // task due date
    bool HasTime,
    string? Location,
    TaskPriority? Priority,
    IReadOnlyList<ReminderDto> Reminders,
    RecurrenceFrequency? Recurrence,
    string? Clarification,
    double? Confidence,
    bool AddsToCurrent = false,
    string? SourceText = null, // the user's words it came from - finds its part of a recording
    string? Unrelated = null, // adding to an item: words that weren't about it
    RecurrenceDto? RecurrenceRule = null); // how it repeats (Recurrence + its days and interval)

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

    /// <param name="locale">The user's locale - the server's own questions are written in it.</param>
    public static NormalizedExtraction Normalize(RawExtraction raw, string inputText, DateTime localNow, TimeZoneInfo timeZone, string? locale = null)
    {
        var texts = ClarificationTexts.For(locale);
        var items = raw.Items
            .Take(MaxItems)
            .Select(item => NormalizeItem(item, localNow, timeZone, texts))
            .OfType<NormalizedItem>()
            .ToList();

        var title = Clean(raw.Title, MaxTitleLength)
            ?? items.FirstOrDefault()?.Title
            ?? Clean(inputText, 60)
            ?? texts.DefaultCaptureTitle;

        // Nothing is ever a dead end (user's rule): if the AI found nothing it
        // could use - a question, a stray thought - keep the words as a note the
        // user can save as-is or turn into a task or event in the review.
        if (items.Count == 0 && Clean(inputText, 4000) is { } text)
        {
            items.Add(new NormalizedItem(
                ExtractionIntent.Note,
                Clean(raw.Title, MaxTitleLength) ?? Clean(inputText, 80) ?? texts.DefaultNoteTitle,
                Summary: null,
                Description: text,
                StartUtc: null, EndUtc: null, DueUtc: null, HasTime: false,
                Location: null, Priority: null, Reminders: [], Recurrence: null,
                Clarification: null, Confidence: null, SourceText: text));
        }

        return new NormalizedExtraction(title, Clean(raw.Summary, 2000), items);
    }

    public static NormalizedItem? NormalizeItem(RawExtractedItem raw, DateTime localNow, TimeZoneInfo timeZone, ClarificationTexts? texts = null)
    {
        var title = Clean(raw.Title, MaxTitleLength);
        if (title is null)
        {
            return null; // Nothing actionable without a title.
        }

        var intent = ParseIntent(raw.Intent);
        // A reminder isn't a type of its own (user's rule): the legacy "reminder"
        // intent is a task that reminds you at its time.
        var remindAtItsTime = intent == ExtractionIntent.Reminder;
        if (remindAtItsTime)
        {
            intent = ExtractionIntent.Task;
        }

        var questions = new Questions(texts ?? ClarificationTexts.English);
        if (Clean(raw.Clarification, 500) is { } fromProvider)
        {
            questions.FromProvider(fromProvider);
        }

        var date = ParseDate(raw.Date, localNow, questions);
        var time = ParseTime(raw.Time);
        var endTime = ParseTime(raw.EndTime);

        // "At 3pm" with no date means the next 3pm - but not when a date was given and
        // couldn't be used ("the 31st of February") or the AI is asking about it:
        // then it stays open (an item being edited keeps its own date).
        var dateUnusable = !string.IsNullOrWhiteSpace(raw.Date) || !string.IsNullOrWhiteSpace(raw.Clarification);
        if (date is null && time is not null && intent != ExtractionIntent.Note && !dateUnusable)
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
                    questions.Ask(questions.Texts.WhenIsAppointment);
                }
                else if (time is null)
                {
                    questions.Ask(questions.Texts.WhatTimeStarts);
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
                if (date is not null)
                {
                    hasTime = time is not null;
                    dueUtc = time is null
                        ? UserTimeZoneHelper.LocalDateStartToUtc(date.Value, timeZone)
                        : ToUtc(date.Value, time.Value, timeZone);
                }
                break;
        }

        // "Buy milk this evening" said at 22:00 resolves to a time that has passed;
        // keep it, but make the user look at it rather than save a stale item.
        if (intent != ExtractionIntent.Note && date is not null && IsInPast(date.Value, time, localNow))
        {
            questions.Warn(questions.Texts.TimePassed);
        }

        IReadOnlyList<RawReminder> rawReminders = raw.Reminders is { Count: > 0 } given
            ? given
            : remindAtItsTime ? [new RawReminder("before", 0, null, null, null)] : [];
        var reminders = rawReminders
            .Take(ReminderPlanner.MaxPerItem)
            .Select(r => NormalizeReminder(r, intent, hasTime, localNow, timeZone, questions))
            .OfType<ReminderDto>()
            .ToList();

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
            reminders,
            ParseRecurrence(raw.Recurrence),
            questions.Count > 0 ? Truncate(string.Join(" ", questions.Distinct()), 500) : null,
            raw.Confidence is { } c && double.IsFinite(c) ? Math.Clamp(c, 0, 1) : null,
            raw.AddsToCurrent,
            Clean(raw.SourceText, 4000),
            Clean(raw.Unrelated, 4000),
            intent == ExtractionIntent.Note ? null : ParseRule(ParseRecurrence(raw.Recurrence), raw.RecurrenceDays, raw.RecurrenceInterval));
    }

    /// <summary>
    /// The item's reminder, or null. Anything missing (a time, the days) becomes
    /// a question and is left empty for the user to fill in on the review.
    /// </summary>
    private static ReminderDto? NormalizeReminder(
        RawReminder? raw, ExtractionIntent intent, bool itemHasTime, DateTime localNow, TimeZoneInfo timeZone, Questions questions)
    {
        if (raw is null || !Enum.TryParse<ReminderKind>(raw.Kind?.Trim(), ignoreCase: true, out var kind) || !Enum.IsDefined(kind))
        {
            return null;
        }

        var time = ParseTime(raw.Time);
        switch (kind)
        {
            case ReminderKind.Before when intent != ExtractionIntent.Note:
                if (!itemHasTime)
                {
                    questions.Ask(questions.Texts.WhatTimeRemind);
                }
                var minutes = raw.MinutesBefore is >= 0 and <= MaxReminderMinutes ? raw.MinutesBefore.Value : 0;
                return new ReminderDto(ReminderKind.Before, MinutesBefore: minutes);

            case ReminderKind.At:
            case ReminderKind.Before: // on a note there is no time to count back from
                var date = ParseDate(raw.Date, localNow, questions);
                if (date is null && time is not null)
                {
                    var today = DateOnly.FromDateTime(localNow);
                    date = today.ToDateTime(time.Value) > localNow ? today : today.AddDays(1);
                }
                if (date is null || time is null)
                {
                    questions.Ask(questions.Texts.WhenRemind);
                    return new ReminderDto(ReminderKind.At);
                }
                if (IsInPast(date.Value, time, localNow))
                {
                    questions.Warn(questions.Texts.ReminderPassed);
                }
                return new ReminderDto(ReminderKind.At, AtUtc: ToUtc(date.Value, time.Value, timeZone));

            default: // daily, weekdays, weekly
                if (time is null)
                {
                    questions.Ask(questions.Texts.WhatTimeRemind);
                }
                IReadOnlyList<DayOfWeek>? days = null;
                if (kind == ReminderKind.Weekly)
                {
                    days = (raw.Days ?? [])
                        .Select(d => Enum.TryParse<DayOfWeek>(d?.Trim(), ignoreCase: true, out var day) && Enum.IsDefined(day) ? (DayOfWeek?)day : null)
                        .OfType<DayOfWeek>()
                        .Distinct()
                        .ToList();
                    if (days.Count == 0)
                    {
                        questions.Ask(questions.Texts.WhichDays);
                    }
                }
                return new ReminderDto(kind, Time: time is { } t ? ReminderSchedule.FormatTime(t) : null, Days: days);
        }
    }

    private static bool IsInPast(DateOnly date, TimeOnly? time, DateTime localNow) =>
        time is null
            ? date < DateOnly.FromDateTime(localNow)
            : date.ToDateTime(time.Value) < localNow;

    private static ExtractionIntent ParseIntent(string? value) =>
        Enum.TryParse<ExtractionIntent>(value?.Trim(), ignoreCase: true, out var intent) && Enum.IsDefined(intent)
            ? intent
            : ExtractionIntent.Task;

    private static DateOnly? ParseDate(string? value, DateTime localNow, Questions questions)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }
        if (!DateOnly.TryParseExact(value.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
        {
            questions.Warn(questions.Texts.CheckDate);
            return null;
        }
        // A planner item years away (or long past) is almost certainly a misread.
        var today = DateOnly.FromDateTime(localNow);
        if (date < today.AddYears(-1) || date > today.AddYears(5))
        {
            questions.Warn(questions.Texts.CheckDate);
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

    /// <summary>A repeat rule from the AI's answer (days only for weekly, interval 1-99).</summary>
    private static RecurrenceDto? ParseRule(RecurrenceFrequency? frequency, IReadOnlyList<string>? days, int? interval)
    {
        if (frequency is not (RecurrenceFrequency.Daily or RecurrenceFrequency.Weekdays or RecurrenceFrequency.Weekly or RecurrenceFrequency.Monthly) ) return null;
        var weekdays = frequency == RecurrenceFrequency.Weekly
            ? (days ?? []).Select(d => Enum.TryParse<DayOfWeek>(d, ignoreCase: true, out var day) ? day : (DayOfWeek?)null).OfType<DayOfWeek>().Distinct().ToList()
            : [];
        return new RecurrenceDto(frequency.Value, Math.Clamp(interval ?? 1, 1, 99), weekdays.Count > 0 ? weekdays : null);
    }

    private static RecurrenceFrequency? ParseRecurrence(string? value) =>
        Enum.TryParse<RecurrenceFrequency>(value?.Trim(), ignoreCase: true, out var r) && Enum.IsDefined(r) && r != RecurrenceFrequency.None
            ? r
            : null;

    /// <summary>
    /// Wall-clock time in the user's zone to UTC. A time that doesn't exist
    /// (skipped by a DST jump) is moved forward by the size of the jump.
    /// </summary>
    private static DateTime ToUtc(DateOnly date, TimeOnly time, TimeZoneInfo timeZone) =>
        UserTimeZoneHelper.LocalToUtc(date.ToDateTime(time), timeZone);

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
