using AiPlanner.Domain.Common;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Domain.Entities;

/// <summary>
/// A reminder on exactly one item (task, appointment or note). An item can
/// have several; removed ones are kept as cancelled rows (sync).
/// </summary>
public class Reminder : BaseEntity
{
    public Guid? TaskItemId { get; set; }
    public TaskItem? TaskItem { get; set; }
    public Guid? AppointmentId { get; set; }
    public Appointment? Appointment { get; set; }
    public Guid? NoteId { get; set; }
    public Note? Note { get; set; }

    public ReminderKind Kind { get; set; }
    /// <summary>Kind = Before: minutes before the item's time.</summary>
    public int? MinutesBefore { get; set; }
    /// <summary>Repeating kinds: wall-clock time in the user's timezone.</summary>
    public TimeOnly? TimeOfDay { get; set; }
    /// <summary>Kind = Weekly: bit (1 &lt;&lt; (int)DayOfWeek) per chosen day.</summary>
    public int DaysOfWeek { get; set; }

    /// <summary>
    /// When it next goes off: the fixed time (At), the item's time minus
    /// MinutesBefore (Before), or the next occurrence (repeating kinds).
    /// </summary>
    public DateTime TriggerAtUtc { get; set; }
    /// <summary>Turned off (by the user, a replacement, or completing the item).</summary>
    public bool IsCancelled { get; set; }
    /// <summary>Turned off because the item was completed/cancelled; reopening brings it back.</summary>
    public bool PausedWithItem { get; set; }
}
