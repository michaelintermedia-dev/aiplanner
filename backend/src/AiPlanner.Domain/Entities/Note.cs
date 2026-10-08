using AiPlanner.Domain.Common;

namespace AiPlanner.Domain.Entities;

public class Note : BaseEntity
{
    public string? Title { get; set; }
    public string Content { get; set; } = default!;
    public string? AiSummary { get; set; }

    public Guid? SourceAiExtractionId { get; set; }
    public AIExtraction? SourceAiExtraction { get; set; }

    /// <summary>"Remind me about this at …" - a note has no date of its own.</summary>
    public ICollection<Reminder> Reminders { get; set; } = new List<Reminder>();
    public ICollection<NoteTag> NoteTags { get; set; } = new List<NoteTag>();
}
