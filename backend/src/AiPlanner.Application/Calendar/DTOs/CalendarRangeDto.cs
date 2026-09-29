using AiPlanner.Application.Tasks.DTOs;

namespace AiPlanner.Application.Calendar.DTOs;

public record CalendarRangeDto(
    DateTime FromUtc,
    DateTime ToUtc,
    IReadOnlyList<CalendarItemDto> Items,
    /// <summary>Open-ended tasks (spec section 10 "Ongoing") shown alongside the grid since they have no fixed date.</summary>
    IReadOnlyList<TaskItemDto> OngoingTasks);
