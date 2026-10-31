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
/// <param name="Origin">How the item was made: spoken, typed to the AI, or by hand (FromVoice = Voice).</param>
/// <param name="HasPhoto">Has a photo attached.</param>
/// <param name="HasFile">Has a document attached.</param>
/// <param name="HasLink">Has a web link in its title or text.</param>
/// <param name="HasPlace">Has a place.</param>
/// <param name="HasMedia">Has a photo or a document (the "With media" chip).</param>
/// <param name="WithOverdue">With a date range: open tasks due before it come too (the "Today" chip = today + overdue).</param>
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
    IReadOnlyList<string>? Tags = null,
    FeedOrigin Origin = FeedOrigin.Any,
    bool HasPhoto = false,
    bool HasFile = false,
    bool HasLink = false,
    bool HasPlace = false,
    bool HasMedia = false,
    bool WithOverdue = false)
{
    public static readonly FeedFilter None = new();
}

public enum FeedReminderFilter { Any, With, Repeating, Without }

/// <summary>How an item was made (filters, 2026-10-13): spoken, typed to the AI, or by hand.</summary>
public enum FeedOrigin { Any, Voice, Typed, Manual }

/// <summary>
/// Open: tasks not completed/cancelled, events still ahead, and notes (nothing to
/// finish - spec v2). Done: completed or cancelled, plus events that have passed;
/// notes are left out.
/// </summary>
public enum FeedStatusFilter { Any, Open, Done }
