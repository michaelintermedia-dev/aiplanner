namespace AiPlanner.Application.Notes.DTOs;

/// <summary>A note: information to keep, with nothing to do (spec section 9) - optionally with a reminder.</summary>
public record NoteDto(
    Guid Id,
    string? Title,
    string Content,
    string? AiSummary,
    Guid? SourceCaptureId, // the capture it was created from, if any
    DateTime? ReminderAtUtc, // pending "remind me about this" time, if any
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);
