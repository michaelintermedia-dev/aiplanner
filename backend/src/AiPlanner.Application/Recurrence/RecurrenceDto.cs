using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Recurrence;

/// <summary>
/// How a task or event repeats (spec section 24). Frequency is Daily, Weekdays,
/// Weekly or Monthly; Interval = every N days/weeks/months (Weekdays ignores
/// it). Days: Weekly's days (default: the item's own weekday). MonthDay:
/// Monthly's day (default: the item's own day; 31 means the month's last day
/// in shorter months). Until: the last local date it can fall on; Count: how
/// many times in all, the item's own date counting as the first. The item's
/// own date/time is the first occurrence and sets the time of all of them.
/// </summary>
public record RecurrenceDto(
    RecurrenceFrequency Frequency,
    int Interval = 1,
    IReadOnlyList<DayOfWeek>? Days = null,
    int? MonthDay = null,
    DateOnly? Until = null,
    int? Count = null);
