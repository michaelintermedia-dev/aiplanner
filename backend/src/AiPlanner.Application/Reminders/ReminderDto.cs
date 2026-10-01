using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Reminders;

/// <summary>
/// A reminder as clients send and receive it, the same on tasks, appointments,
/// notes and capture items. Which fields matter depends on Kind:
/// At - AtUtc; Before - MinutesBefore; Daily/Weekdays - Time; Weekly - Time + Days.
/// NextAtUtc is output only (when it next goes off).
/// </summary>
public record ReminderDto(
    ReminderKind Kind,
    DateTime? AtUtc = null,
    int? MinutesBefore = null,
    string? Time = null, // "HH:mm", the user's local time
    IReadOnlyList<DayOfWeek>? Days = null,
    DateTime? NextAtUtc = null);
