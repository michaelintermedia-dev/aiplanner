using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Captures.DTOs;

/// <summary>
/// A proposed task/appointment/note. Dates are UTC: StartUtc/EndUtc for
/// appointments, DueUtc for tasks. Any of them can carry reminders. Once saved, the Resulting*
/// id points at the real item. AudioStartMs/AudioEndMs: the part of the recording
/// it came from (on the whole-recording timeline), if known.
/// </summary>
public record CaptureItemDto(
    Guid Id,
    ExtractionIntent Intent,
    ExtractionStatus Status,
    string Title,
    string? Summary,
    string? Description,
    DateTime? StartUtc,
    DateTime? EndUtc,
    DateTime? DueUtc,
    bool HasTime,
    string? Location,
    TaskPriority? Priority,
    IReadOnlyList<ReminderDto> Reminders,
    RecurrenceFrequency? Recurrence,
    string? Clarification,
    double? Confidence,
    Guid? ResultingTaskId,
    Guid? ResultingAppointmentId,
    Guid? ResultingNoteId,
    bool AddsToCurrent = false,
    int? AudioStartMs = null,
    int? AudioEndMs = null,
    string? ContinuesItemType = null, // "Add more" on a saved item: which one
    Guid? ContinuesItemId = null,
    string? Unrelated = null, // "Add more": words that weren't about the item
    bool HeldByEditForm = false); // made in an item's Edit form - not an unsaved review elsewhere
