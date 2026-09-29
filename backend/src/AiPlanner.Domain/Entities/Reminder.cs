using AiPlanner.Domain.Common;

namespace AiPlanner.Domain.Entities;

public class Reminder : BaseEntity
{
    public Guid? TaskItemId { get; set; }
    public TaskItem? TaskItem { get; set; }
    public Guid? AppointmentId { get; set; }
    public Appointment? Appointment { get; set; }
    public DateTime TriggerAtUtc { get; set; }
    public bool IsCancelled { get; set; }
}
