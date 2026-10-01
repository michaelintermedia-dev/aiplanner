using AiPlanner.Application.Reminders;

namespace AiPlanner.Application.Notes.DTOs;

/// <summary>Create or replace a note. Null/empty Reminders means none (PUT replaces them).</summary>
public record SaveNoteRequest(string? Title, string Content, IReadOnlyList<ReminderDto>? Reminders = null);
