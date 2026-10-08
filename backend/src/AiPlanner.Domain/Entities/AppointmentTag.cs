namespace AiPlanner.Domain.Entities;

/// <summary>A tag on an appointment (like TaskTag on a task).</summary>
public class AppointmentTag
{
    public Guid AppointmentId { get; set; }
    public Appointment Appointment { get; set; } = default!;
    public Guid TagId { get; set; }
    public Tag Tag { get; set; } = default!;
}
