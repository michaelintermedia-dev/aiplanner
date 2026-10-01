namespace AiPlanner.Application.Feed.DTOs;

/// <summary>
/// One entry of the unified feed - a task, an appointment ("event") or a note -
/// with just what a list row needs. Open the item itself for everything else.
/// </summary>
public record FeedItemDto(
    Guid Id,
    FeedKind Kind,
    string Title,
    string? Snippet, // note text, or a task/appointment description
    string? Status, // task/appointment status; null for notes
    DateTime? DateUtc, // task due date or appointment start
    DateTime? EndUtc, // appointment end
    bool HasTime,
    string? Priority, // tasks only; null when none
    string? Location, // appointments only
    IReadOnlyList<string> Tags,
    bool FromCapture, // created by the AI from a capture
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);
