using AiPlanner.Domain.Enums;
using AiPlanner.Application.Reminders;

namespace AiPlanner.Application.Notes.DTOs;

/// <summary>A note: information to keep, with nothing to do (spec section 9) - optionally with a reminder.</summary>
public record NoteDto(
    Guid Id,
    string? Title,
    string Content,
    string? AiSummary,
    Guid? SourceCaptureId, // the capture it was created from, if any
    IReadOnlyList<ReminderDto> Reminders, // "remind me about this"
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    IReadOnlyList<string>? Tags = null,
    TaskPriority Priority = TaskPriority.None,
    string? Location = null,
    IReadOnlyList<string>? People = null);
