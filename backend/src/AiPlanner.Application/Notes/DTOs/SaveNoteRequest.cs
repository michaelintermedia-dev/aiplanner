namespace AiPlanner.Application.Notes.DTOs;

/// <summary>Create or replace a note.</summary>
public record SaveNoteRequest(string? Title, string Content);
