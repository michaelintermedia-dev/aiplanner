using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Captures.DTOs;

/// <summary>One reviewed item. Dates are UTC, as in CaptureItemDto.</summary>
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
    int? ReminderMinutesBefore);
