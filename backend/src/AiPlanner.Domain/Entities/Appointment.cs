using AiPlanner.Domain.Common;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Domain.Entities;

public class Appointment : BaseEntity
{
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public string? Notes { get; set; }
    public string? AiSummary { get; set; }
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public string? Location { get; set; }
    public AppointmentStatus Status { get; set; } = AppointmentStatus.Scheduled;

    public Guid? RecurrenceRuleId { get; set; }
    public RecurrenceRule? RecurrenceRule { get; set; }

    public Guid? SourceAiExtractionId { get; set; }
    public AIExtraction? SourceAiExtraction { get; set; }

    public ICollection<AppointmentParticipant> Participants { get; set; } = new List<AppointmentParticipant>();
    public ICollection<Reminder> Reminders { get; set; } = new List<Reminder>();
}
