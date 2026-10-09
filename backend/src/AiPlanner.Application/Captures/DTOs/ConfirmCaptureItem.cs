using AiPlanner.Application.Recurrence;
using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Captures.DTOs;

/// <summary>
/// One reviewed item. Dates are UTC, as in CaptureItemDto. With AppendToType/
/// AppendToId the item isn't created but goes into that existing item
/// (continuing a capture): with ReplacesItem the fields are the whole item after
/// the addition and update it in place (title and created date kept);
/// without, only the text is appended to its details. With LinkOnly the item
/// was already saved through its own form (the item's Edit page): the proposal
/// is only recorded as part of it (its words and audio clip), nothing is applied.
/// </summary>
public record ConfirmCaptureItem(
    Guid Id,
    bool Include,
    ExtractionIntent Intent,
    string Title,
    string? Description,
    DateTime? StartUtc,
    DateTime? EndUtc,
    DateTime? DueUtc,
    bool HasTime,
    string? Location,
    TaskPriority? Priority,
    IReadOnlyList<ReminderDto>? Reminders,
    string? AppendToType = null, // "Task" | "Appointment" | "Note"
    Guid? AppendToId = null,
    bool ReplacesItem = false,
    bool LinkOnly = false,
    RecurrenceDto? Recurrence = null, // tasks (with a date) and events only
    IReadOnlyList<string>? Tags = null, // null: none (new) / unchanged (an update)
    // The review is the full Edit form (user's call, 2026-10-09): what it has beyond the AI's fields.
    string? Notes = null, // tasks and events
    IReadOnlyList<string>? ParticipantNames = null, // events
    bool IsOngoing = false); // a task without a deadline
