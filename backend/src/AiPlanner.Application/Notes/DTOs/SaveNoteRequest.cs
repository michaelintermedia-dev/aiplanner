using AiPlanner.Domain.Enums;
using AiPlanner.Application.Reminders;

namespace AiPlanner.Application.Notes.DTOs;

/// <summary>Create or replace a note. Null/empty Reminders means none (PUT replaces them); Tags null = unchanged.</summary>
public record SaveNoteRequest(
    string? Title,
    string Content,
    IReadOnlyList<ReminderDto>? Reminders = null,
    IReadOnlyList<string>? Tags = null,
    // Every type has the same attributes (user's call, 2026-10-09). Null priority/people: unchanged on update.
    TaskPriority? Priority = null,
    string? Location = null,
    IReadOnlyList<string>? People = null);
