namespace AiPlanner.Application.Feed.DTOs;

/// <param name="Kinds">Which kinds to include; empty means all.</param>
/// <param name="Cursor">Opaque position from the previous page's NextCursor.</param>
/// <param name="Filter">Optional narrowing (text, dates, reminders, status).</param>
/// <param name="Sorts">Sort criteria in order; empty = newest first.</param>
public record FeedQueryParameters(IReadOnlyCollection<FeedKind> Kinds, IReadOnlyList<FeedSort> Sorts, string? Cursor, int Take, FeedFilter? Filter = null);
