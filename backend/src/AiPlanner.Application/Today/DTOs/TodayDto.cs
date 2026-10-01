using AiPlanner.Application.Appointments.DTOs;
using AiPlanner.Application.Tasks.DTOs;

namespace AiPlanner.Application.Today.DTOs;

public record UpcomingReminderDto(
    Guid ReminderId,
    DateTime TriggerAtUtc,
    string Title,
    string SourceType, // "Task" | "Appointment" | "Note"
    Guid SourceId);

/// <summary>
/// The Today dashboard (spec section 13): today's appointments, tasks due
/// today, open-ended Ongoing tasks, overdue tasks, and what's coming up next.
/// </summary>
public record TodayDto(
    DateOnly Date,
    IReadOnlyList<AppointmentDto> AppointmentsToday,
    IReadOnlyList<TaskItemDto> TasksDueToday,
    IReadOnlyList<TaskItemDto> OngoingTasks,
    IReadOnlyList<TaskItemDto> OverdueTasks,
    IReadOnlyList<UpcomingReminderDto> UpcomingReminders);
