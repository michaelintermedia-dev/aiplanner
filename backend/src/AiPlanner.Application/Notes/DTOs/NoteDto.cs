namespace AiPlanner.Application.Notes.DTOs;

/// <summary>A note: information to keep, with nothing to do and no time (spec section 9).</summary>
public record NoteDto(
    Guid Id,
    string? Title,
    string Content,
    string? AiSummary,
    Guid? SourceCaptureId, // the capture it was created from, if any
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);
