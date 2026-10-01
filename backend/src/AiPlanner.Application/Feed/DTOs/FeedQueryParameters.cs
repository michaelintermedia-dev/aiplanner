namespace AiPlanner.Application.Feed.DTOs;

/// <param name="Kinds">Which kinds to include; empty means all.</param>
/// <param name="Cursor">Opaque position from the previous page's NextCursor.</param>
public record FeedQueryParameters(IReadOnlyCollection<FeedKind> Kinds, FeedSort Sort, string? Cursor, int Take);
