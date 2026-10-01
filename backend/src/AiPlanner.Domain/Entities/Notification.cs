using AiPlanner.Domain.Common;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Domain.Entities;

/// <summary>
/// A notification the server keeps a record of. Regular reminder occurrences are
/// computed on the fly (NotificationService); rows exist for snoozes.
/// </summary>
public class Notification : BaseEntity
{
    public NotificationType Type { get; set; }
    public NotificationStatus Status { get; set; } = NotificationStatus.Scheduled;
    public string Title { get; set; } = default!;
    public string? Body { get; set; }
    public DateTime ScheduledForUtc { get; set; }
    public DateTime? SentAtUtc { get; set; }
    public DateTime? SnoozedUntilUtc { get; set; }

    public Guid? ReminderId { get; set; }
    public Reminder? Reminder { get; set; }
    public Guid? TaskItemId { get; set; }
    public TaskItem? TaskItem { get; set; }
    public Guid? AppointmentId { get; set; }
    public Appointment? Appointment { get; set; }
    public Guid? NoteId { get; set; }
    public Note? Note { get; set; }
}
