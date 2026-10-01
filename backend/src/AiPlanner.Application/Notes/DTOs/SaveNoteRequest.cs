namespace AiPlanner.Application.Notes.DTOs;

/// <summary>Create or replace a note. A null ReminderAtUtc means no reminder.</summary>
public record SaveNoteRequest(string? Title, string Content, DateTime? ReminderAtUtc = null);
