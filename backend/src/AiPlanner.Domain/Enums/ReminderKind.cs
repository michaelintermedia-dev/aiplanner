namespace AiPlanner.Domain.Enums;

/// <summary>
/// How a reminder is scheduled. Repeating kinds keep going off until the user
/// turns them off (or the item is completed/cancelled/deleted).
/// </summary>
public enum ReminderKind
{
    /// <summary>Once, at a fixed moment ("in an hour", "tomorrow 9:00").</summary>
    At = 0,
    /// <summary>Once, a number of minutes before the item's own time; moves with the item.</summary>
    Before = 1,
    /// <summary>Every day at a local time.</summary>
    Daily = 2,
    /// <summary>Monday to Friday at a local time.</summary>
    Weekdays = 3,
    /// <summary>On chosen days of the week at a local time.</summary>
    Weekly = 4,
}
