using AiPlanner.Domain.Common;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Domain.Entities;

public class TaskItem : BaseEntity
{
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public string? Notes { get; set; }
    public string? AiSummary { get; set; }
    public DateTime? StartDateUtc { get; set; }
    public DateTime? DueDateUtc { get; set; }
    public bool HasDueTime { get; set; }
    public TaskItemStatus Status { get; set; } = TaskItemStatus.Inbox;
    public TaskPriority Priority { get; set; } = TaskPriority.None;
    public DateTime? CompletedAtUtc { get; set; }

    public Guid? RecurrenceRuleId { get; set; }
    public RecurrenceRule? RecurrenceRule { get; set; }

    public Guid? SourceAiExtractionId { get; set; }
    public AIExtraction? SourceAiExtraction { get; set; }

    public ICollection<TaskTag> TaskTags { get; set; } = new List<TaskTag>();
    public ICollection<Reminder> Reminders { get; set; } = new List<Reminder>();
}
