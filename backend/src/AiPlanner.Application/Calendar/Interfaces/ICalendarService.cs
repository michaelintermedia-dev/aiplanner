using AiPlanner.Application.Calendar.DTOs;

namespace AiPlanner.Application.Calendar.Interfaces;

public interface ICalendarService
{
    Task<CalendarRangeDto> GetRangeAsync(CalendarQueryParameters query, CancellationToken ct = default);
}
