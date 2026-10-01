namespace AiPlanner.Application.Feed.DTOs;

/// <summary>A page of the feed. Pass <see cref="NextCursor"/> back to get the next page; null means the end.</summary>
public record FeedPageDto(IReadOnlyList<FeedItemDto> Items, string? NextCursor);
