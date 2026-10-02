namespace AiPlanner.Application.Feed.DTOs;

/// <summary>
/// One sort criterion. The feed takes several, applied in order (the first
/// decides, later ones break ties).
/// </summary>
public enum FeedSort
{
    /// <summary>Newest first (default).</summary>
    CreatedDesc = 0,
    CreatedAsc = 1,
    UpdatedDesc = 2,
    /// <summary>By due/start date, soonest first; items without a date last.</summary>
    DateAsc = 3,
    /// <summary>Tasks with High priority before everything else.</summary>
    PriorityHigh = 4,
}
