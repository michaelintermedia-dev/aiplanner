using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Captures.DTOs;

/// <summary>
/// One reviewed item. Dates are UTC, as in CaptureItemDto. With AppendToType/
/// AppendToId the item isn't created but goes into that existing item
/// (continuing a capture): with ReplacesItem the fields are the whole item after
/// the addition and update it in place (title and created date kept);
/// without, only the text is appended to its details.
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
    bool ReplacesItem = false);
