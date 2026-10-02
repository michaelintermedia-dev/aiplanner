using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Captures.DTOs;

/// <summary>
/// One reviewed item. Dates are UTC, as in CaptureItemDto. With AppendToType/
/// AppendToId the item isn't created: its text is added to that existing item
/// (continuing a capture to complete a thought).
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
    Guid? AppendToId = null);
