using AiPlanner.Domain.Common;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Domain.Entities;

public class Note : ItemBase
{
    public string? Title { get; set; }
    public string Content { get; set; } = default!;
    public string? AiSummary { get; set; }

    // Every type has the same attributes (user's call, 2026-10-09): priority, a place, people.
    public TaskPriority Priority { get; set; } = TaskPriority.None;
    public string? Location { get; set; }
    public List<string> People { get; set; } = [];

    public Guid? SourceAiExtractionId { get; set; }
    public AIExtraction? SourceAiExtraction { get; set; }

    /// <summary>"Remind me about this at …" - a note has no date of its own.</summary>
    public ICollection<Reminder> Reminders { get; set; } = new List<Reminder>();
    public ICollection<NoteTag> NoteTags { get; set; } = new List<NoteTag>();
}
