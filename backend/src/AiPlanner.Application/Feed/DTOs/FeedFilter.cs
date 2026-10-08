namespace AiPlanner.Application.Feed.DTOs;

/// <summary>
/// Optional narrowing of the feed, applied within the chosen kinds (the All /
/// Tasks / Events / Notes tab). Date ranges come from the client in UTC, already
/// turned from "today / last 7 days" into the user's timezone boundaries.
/// </summary>
/// <param name="Text">Words to find in titles, details, note text, location and tags.</param>
/// <param name="CreatedFromUtc">Created at or after (inclusive).</param>
/// <param name="CreatedToUtc">Created before (exclusive).</param>
/// <param name="DateFromUtc">Task due / event start at or after (inclusive).</param>
/// <param name="DateToUtc">Task due / event start before (exclusive).</param>
/// <param name="NoDate">Only undated items (undated tasks, notes).</param>
/// <param name="FromVoice">Only items created from a voice capture.</param>
/// <param name="Tags">Any of these tags (case-insensitive) - on any kind of item.</param>
public record FeedFilter(
    string? Text = null,
    DateTime? CreatedFromUtc = null,
    DateTime? CreatedToUtc = null,
    FeedReminderFilter Reminders = FeedReminderFilter.Any,
    FeedStatusFilter Status = FeedStatusFilter.Any,
    DateTime? DateFromUtc = null,
    DateTime? DateToUtc = null,
    bool NoDate = false,
    bool FromVoice = false,
    IReadOnlyList<string>? Tags = null)
{
    public static readonly FeedFilter None = new();
}

public enum FeedReminderFilter { Any, With, Repeating, Without }

/// <summary>
/// Open: tasks not completed/cancelled, events still ahead. Done: completed or
/// cancelled, plus events that have passed. Notes have no status, so a status
/// filter leaves them out.
/// </summary>
public enum FeedStatusFilter { Any, Open, Done }
