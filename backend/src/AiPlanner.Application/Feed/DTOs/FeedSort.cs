namespace AiPlanner.Application.Feed.DTOs;

public enum FeedSort
{
    /// <summary>Newest first (default).</summary>
    CreatedDesc = 0,
    CreatedAsc = 1,
    UpdatedDesc = 2,
    /// <summary>By due/start date, soonest first; items without a date last.</summary>
    DateAsc = 3,
}
