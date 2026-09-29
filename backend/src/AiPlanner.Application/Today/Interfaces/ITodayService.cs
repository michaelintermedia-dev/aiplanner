using AiPlanner.Application.Today.DTOs;

namespace AiPlanner.Application.Today.Interfaces;

public interface ITodayService
{
    /// <summary>date: the local calendar date to summarize, in the user's own timezone. Defaults to "now" in that timezone.</summary>
    Task<TodayDto> GetTodayAsync(DateOnly? date, CancellationToken ct = default);
}
