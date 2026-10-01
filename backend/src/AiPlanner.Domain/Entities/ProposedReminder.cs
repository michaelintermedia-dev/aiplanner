using AiPlanner.Domain.Enums;

namespace AiPlanner.Domain.Entities;

/// <summary>
/// A reminder the AI proposed (or the user edited) on a capture item, before
/// anything is saved. Stored as JSON on the item; same fields as Reminder.
/// </summary>
public class ProposedReminder
{
    public ReminderKind Kind { get; set; }
    public DateTime? AtUtc { get; set; }
    public int? MinutesBefore { get; set; }
    public TimeOnly? TimeOfDay { get; set; }
    public int DaysOfWeek { get; set; }
}
