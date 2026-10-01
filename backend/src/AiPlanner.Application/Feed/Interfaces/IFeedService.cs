using AiPlanner.Application.Feed.DTOs;

namespace AiPlanner.Application.Feed.Interfaces;

/// <summary>The unified feed: tasks, appointments and notes in one list.</summary>
public interface IFeedService
{
    Task<FeedPageDto> GetPageAsync(FeedQueryParameters query, CancellationToken ct = default);
}
