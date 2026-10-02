namespace AiPlanner.Application.Feed.DTOs;

/// <summary>One of the user's tags and how many tasks use it.</summary>
public record FeedTagDto(string Name, int Count);
