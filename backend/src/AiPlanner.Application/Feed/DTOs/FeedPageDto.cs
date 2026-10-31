namespace AiPlanner.Application.Feed.DTOs;

/// <summary>A page of the feed. Pass <see cref="NextCursor"/> back to get the next page; null means the end.</summary>
/// <param name="Sections">Smart order: how many items each section has in all (for "Done (12)").</param>
public record FeedPageDto(IReadOnlyList<FeedItemDto> Items, string? NextCursor, IReadOnlyDictionary<string, int>? Sections = null);
