using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Recurrence;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Ai.Services;

/// <summary>
/// "Remind me every day to drink water" (bug fix, 2026-10-21; pure, unit tested).
/// A repeating *task* moves its due date on each time it's done, so it needs a
/// date - but a task without a date that "repeats" is really asking for a
/// repeating *reminder*. When the AI still returns such a task, its repeat
/// becomes the matching reminder (daily / weekdays / weekly on its days), at the
/// time that was said (none: the review asks). A repeat no reminder can express
/// (monthly, every N days) keeps the repeat and starts today instead.
/// </summary>
public static class DatelessRepeat
{
    /// <summary>The reminder this repeat means, or null when no reminder kind fits.</summary>
    public static RawReminder? AsReminder(RecurrenceDto rule, string? time)
    {
        if (rule.Interval > 1) return null;
        return rule.Frequency switch
        {
            RecurrenceFrequency.Daily => new RawReminder("daily", null, null, time, null),
            RecurrenceFrequency.Weekdays => new RawReminder("weekdays", null, null, time, null),
            RecurrenceFrequency.Weekly when rule.Days is { Count: > 0 } days => new RawReminder("weekly", null, null, time, days.Select(d => d.ToString()).ToList()),
            _ => null,
        };
    }

    /// <summary>Whether the reminders already repeat (then the converted one isn't added again).</summary>
    public static bool AlreadyRepeats(IEnumerable<RawReminder> reminders) =>
        reminders.Any(r => r.Kind?.Trim().ToLowerInvariant() is "daily" or "weekdays" or "weekly");
}
