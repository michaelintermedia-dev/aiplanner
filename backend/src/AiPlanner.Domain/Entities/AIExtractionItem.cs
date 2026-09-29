using AiPlanner.Domain.Common;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Domain.Entities;

public class AIExtractionItem : BaseEntity
{
    public Guid AiExtractionId { get; set; }
    public AIExtraction AiExtraction { get; set; } = default!;

    public ExtractionIntent Intent { get; set; }
    public ExtractionStatus Status { get; set; } = ExtractionStatus.PendingReview;

    public string Title { get; set; } = default!;
    public string? Summary { get; set; }
    public string? Description { get; set; }
    public DateTime? StartDateUtc { get; set; }
    public DateTime? DueDateUtc { get; set; }
    public DateTime? EndDateUtc { get; set; }
    public string? Location { get; set; }
    public TaskPriority? Priority { get; set; }
    public int? ReminderMinutesBefore { get; set; }
    public RecurrenceFrequency? RecurrenceFrequency { get; set; }
    public double? Confidence { get; set; }

    public Guid? ResultingTaskItemId { get; set; }
    public Guid? ResultingAppointmentId { get; set; }
    public Guid? ResultingNoteId { get; set; }
}
