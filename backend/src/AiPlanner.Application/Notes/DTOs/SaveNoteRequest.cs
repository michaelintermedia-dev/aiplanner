using AiPlanner.Application.Reminders;

namespace AiPlanner.Application.Notes.DTOs;

/// <summary>Create or replace a note. A null Reminder means none (PUT replaces it).</summary>
public record SaveNoteRequest(string? Title, string Content, ReminderDto? Reminder = null);
