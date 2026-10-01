using AiPlanner.Application.Reminders;

namespace AiPlanner.Application.Notes.DTOs;

/// <summary>A note: information to keep, with nothing to do (spec section 9) - optionally with a reminder.</summary>
public record NoteDto(
    Guid Id,
    string? Title,
    string Content,
    string? AiSummary,
    Guid? SourceCaptureId, // the capture it was created from, if any
    ReminderDto? Reminder, // "remind me about this", if any
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);
