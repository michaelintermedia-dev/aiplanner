namespace AiPlanner.Domain.Entities;

public class AppointmentParticipant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AppointmentId { get; set; }
    public Appointment Appointment { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Email { get; set; }
}
