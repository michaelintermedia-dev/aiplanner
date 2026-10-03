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
    /// <summary>False when only a date was understood (e.g. "by Thursday").</summary>
    public bool HasTime { get; set; }
    /// <summary>What the user should check or answer before saving (spec section 15, step 15).</summary>
    public string? Clarification { get; set; }
    public string? Location { get; set; }
    public TaskPriority? Priority { get; set; }
    /// <summary>Proposed reminders (JSON). See Reminder for what each field means per kind.</summary>
    public List<ProposedReminder> ProposedReminders { get; set; } = [];
    public RecurrenceFrequency? RecurrenceFrequency { get; set; }
    public double? Confidence { get; set; }
    /// <summary>
    /// From a continued capture: the AI thinks this completes the item the user
    /// continued from, so the review offers "Add to this item" first.
    /// </summary>
    public bool AddsToCurrent { get; set; }

    /// <summary>"Add more" on a saved item: which one ("Task"/"Appointment"/"Note" + id) - so an unsaved review of it can be resumed.</summary>
    public string? ContinuesItemType { get; set; }
    public Guid? ContinuesItemId { get; set; }

    /// <summary>"Add more": words that weren't about the item, offered as a new capture instead.</summary>
    public string? Unrelated { get; set; }

    /// <summary>
    /// Where in the recording this item was said (ms from the start of the whole
    /// recording, parts back to back), so it can play just its part. Null for
    /// typed captures or when it couldn't be placed - then the whole recording.
    /// </summary>
    public int? AudioStartMs { get; set; }
    /// <summary>
    /// The user's words this item came from (as the AI quoted them). When the
    /// user later adds to the saved item, only these - not the rest of the
    /// message - are its context.
    /// </summary>
    public string? SourceText { get; set; }
    public int? AudioEndMs { get; set; }

    public Guid? ResultingTaskItemId { get; set; }
    public Guid? ResultingAppointmentId { get; set; }
    public Guid? ResultingNoteId { get; set; }
}
