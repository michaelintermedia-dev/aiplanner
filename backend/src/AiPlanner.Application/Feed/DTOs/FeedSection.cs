namespace AiPlanner.Application.Feed.DTOs;

/// <summary>
/// Where an item goes in the Smart order (spec v2, 2026-10-31), top to bottom:
/// open tasks past due, today, later, open tasks without a date, notes, and
/// what's done (completed/cancelled tasks, passed events) last.
/// </summary>
public enum FeedSection
{
    None = 0,
    Overdue = 1,
    Today = 2,
    Upcoming = 3,
    NoDate = 4,
    Notes = 5,
    Done = 6,
}
