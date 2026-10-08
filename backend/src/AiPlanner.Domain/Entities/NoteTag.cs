namespace AiPlanner.Domain.Entities;

/// <summary>A tag on a note (like TaskTag on a task).</summary>
public class NoteTag
{
    public Guid NoteId { get; set; }
    public Note Note { get; set; } = default!;
    public Guid TagId { get; set; }
    public Tag Tag { get; set; } = default!;
}
