using AiPlanner.Application.Recurrence;
using System.Globalization;
using System.Text.Json;
using AiPlanner.Application.Ai.Services;
using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Captures.Services;

/// <summary>
/// The saved item a capture is continued from, written for the AI in the same
/// shape it answers in (local dates, its reminder kinds), so it can return the
/// whole item updated with what the user added. Pure - unit tested.
/// </summary>
public static class ContinuedItem
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = false };

    public static string Describe(
        string intent, string title, string? description, DateTime? whenUtc, bool hasTime, DateTime? endUtc,
        string? location, TaskPriority? priority, IEnumerable<ReminderDto> reminders, TimeZoneInfo zone, RecurrenceDto? recurrence = null,
        IEnumerable<string>? tags = null)
    {
        string? Date(DateTime? utc) => utc is { } u ? TimeZoneInfo.ConvertTimeFromUtc(u, zone).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) : null;
        string? Time(DateTime? utc) => utc is { } u ? TimeZoneInfo.ConvertTimeFromUtc(u, zone).ToString("HH:mm", CultureInfo.InvariantCulture) : null;

        var item = new
        {
            intent,
            title,
            description,
            date = Date(whenUtc),
            time = hasTime ? Time(whenUtc) : null,
            endTime = intent == "appointment" ? Time(endUtc) : null,
            location,
            priority = priority is null or TaskPriority.None ? null : priority.Value.ToString().ToLowerInvariant(),
            reminders = reminders.Select(r => new
            {
                kind = r.Kind.ToString().ToLowerInvariant(),
                minutesBefore = r.Kind == ReminderKind.Before ? r.MinutesBefore : null,
                date = r.Kind == ReminderKind.At ? Date(r.AtUtc) : null,
                time = r.Kind == ReminderKind.At ? Time(r.AtUtc) : r.Time,
                days = r.Kind == ReminderKind.Weekly ? r.Days?.Select(d => d.ToString()).ToList() : null,
            }).ToList(),
            recurrence = recurrence?.Frequency.ToString().ToLowerInvariant(),
            recurrenceDays = recurrence?.Days?.Select(d => d.ToString()).ToList(),
            recurrenceInterval = recurrence is { Interval: > 1 } ? recurrence.Interval : (int?)null,
            tags = (tags ?? []).ToList(),
        };
        return JsonSerializer.Serialize(item, Json);
    }

    /// <summary>An item (e.g. the Edit form's current state) in the same shape.</summary>
    public static string Describe(NormalizedItem item, TimeZoneInfo zone) => Describe(
        item.Intent switch { ExtractionIntent.Appointment => "appointment", ExtractionIntent.Note => "note", _ => "task" },
        item.Title, item.Description, item.StartUtc ?? item.DueUtc, item.HasTime, item.EndUtc, item.Location, item.Priority, item.Reminders, zone,
        item.RecurrenceRule, item.Tags);

    /// <summary>
    /// Whether the merged details carry the user's new words (at least a third
    /// of the longer ones) - if not, they'd be lost, so they get added as-is.
    /// </summary>
    public static bool MentionsWords(string? details, string newWords)
    {
        static IEnumerable<string> Words(string? text) =>
            (text ?? "").ToLowerInvariant().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
                .Select(w => new string(w.Where(char.IsLetterOrDigit).ToArray()))
                .Where(w => w.Length > 3);
        var wanted = Words(newWords).Distinct().ToList();
        if (wanted.Count == 0) return true;
        var present = Words(details).ToHashSet();
        return wanted.Count(present.Contains) * 3 >= wanted.Count;
    }

    /// <summary>The existing details, then the new words as their own paragraph.</summary>
    public static string JoinDetails(string? existing, string addition) =>
        string.IsNullOrWhiteSpace(existing) ? addition.Trim() : $"{existing.TrimEnd()}\n\n{addition.Trim()}";

    /// <summary>
    /// The one proposal kept when adding to an item: the item, updated. Only a
    /// proposal the AI marked as this item counts - anything else it proposed
    /// (it read the words as a new item) never stands in for it; the item stays
    /// as it is and the words go into its details. Fields the proposal left out
    /// (date, time, place, priority) keep the item's values, and the details
    /// keep both the old text and the new words - adding never wipes anything.
    /// </summary>
    public static NormalizedItem Keep(IReadOnlyList<NormalizedItem> proposals, NormalizedItem current, string newWords)
    {
        var proposal = proposals.FirstOrDefault(p => p.AddsToCurrent);
        if (proposal is null)
        {
            return current with
            {
                Description = JoinDetails(current.Description, newWords),
                AddsToCurrent = true,
                SourceText = newWords,
                Clarification = null,
            };
        }

        var kept = proposal with { AddsToCurrent = true };
        // A note takes everything said (user's rule, 2026-10-10): more thoughts are more of the
        // note, never split off as a separate entry - whatever the AI made of them.
        if (current.Intent == ExtractionIntent.Note) kept = kept with { Unrelated = null };
        if (kept.Intent == current.Intent)
        {
            if (kept.Intent == ExtractionIntent.Task && kept.DueUtc is null && current.DueUtc is not null)
            {
                kept = kept with { DueUtc = current.DueUtc, HasTime = current.HasTime, Clarification = null };
            }
            if (kept.Intent == ExtractionIntent.Appointment && kept.StartUtc is null && current.StartUtc is not null)
            {
                kept = kept with { StartUtc = current.StartUtc, EndUtc = current.EndUtc, HasTime = current.HasTime, Clarification = null };
            }
            // A question about it ("February has no 31st - which date?") means the AI isn't
            // sure: the item keeps its own date and time until the user says.
            if (kept.Clarification is not null && (kept.StartUtc != current.StartUtc || kept.DueUtc != current.DueUtc))
            {
                kept = kept with { StartUtc = current.StartUtc, EndUtc = current.EndUtc, DueUtc = current.DueUtc, HasTime = current.HasTime };
            }
            if (kept.Location is null && current.Location is not null) kept = kept with { Location = current.Location };
            if (kept.Priority is null && current.Priority is not null) kept = kept with { Priority = current.Priority };
            if (kept.RecurrenceRule is null && current.RecurrenceRule is not null) kept = kept with { RecurrenceRule = current.RecurrenceRule };
        }
        // No tags back = it left them out, not "remove them all".
        if (kept.Tags is not { Count: > 0 } && current.Tags is { Count: > 0 }) kept = kept with { Tags = current.Tags };
        // Words not about this item are offered as a new capture, not kept here.
        var about = Without(newWords, kept.Unrelated);
        var lostOldText = !MentionsWords(kept.Description, current.Description ?? "");
        if (about.Length == 0)
        {
            kept = kept with { Description = current.Description };
        }
        else if (kept.Clarification is not null && !ChangesFields(kept, current))
        {
            // It asked about what was said ("which date?") instead of doing it: the
            // words were an instruction it couldn't carry out, not details to keep.
            if (lostOldText) kept = kept with { Description = current.Description };
        }
        else if (ChangesFields(kept, current))
        {
            // The words were (at least partly) instructions it carried out - "make it
            // high priority", "remind me at 5": those show as changed fields, so the
            // details are trusted, only never losing what was there.
            if (lostOldText) kept = kept with { Description = JoinDetails(current.Description, kept.Description ?? "").Trim() };
        }
        else if (lostOldText || !MentionsWords(kept.Description, about))
        {
            // Nothing else changed, so the words were information - keep them as said.
            kept = kept with { Description = JoinDetails(current.Description, about) };
        }
        return kept;
    }

    /// <summary>The new words minus the unrelated part (if the AI quoted it verbatim).</summary>
    private static string Without(string newWords, string? unrelated)
    {
        if (string.IsNullOrWhiteSpace(unrelated)) return newWords.Trim();
        var at = newWords.IndexOf(unrelated.Trim(), StringComparison.OrdinalIgnoreCase);
        return at < 0 ? newWords.Trim() : (newWords[..at] + " " + newWords[(at + unrelated.Trim().Length)..]).Trim();
    }

    /// <summary>Whether the update changed anything besides the details (type, time, place, priority, reminders).</summary>
    private static bool ChangesFields(NormalizedItem kept, NormalizedItem current) =>
        kept.Intent != current.Intent
        || kept.StartUtc != current.StartUtc || kept.EndUtc != current.EndUtc
        || kept.DueUtc != current.DueUtc || kept.HasTime != current.HasTime
        || kept.Location != current.Location || kept.Priority != current.Priority
        || !(kept.Tags ?? []).Order(StringComparer.OrdinalIgnoreCase).SequenceEqual((current.Tags ?? []).Order(StringComparer.OrdinalIgnoreCase), StringComparer.OrdinalIgnoreCase)
        || kept.Reminders.Count != current.Reminders.Count
        || kept.Reminders.Zip(current.Reminders).Any(p => !SameReminder(p.First, p.Second));

    /// <summary>The same reminder (what it is, not its next time).</summary>
    private static bool SameReminder(ReminderDto a, ReminderDto b) =>
        a.Kind == b.Kind && a.AtUtc == b.AtUtc && a.MinutesBefore == b.MinutesBefore && a.Time == b.Time
        && (a.Days ?? []).SequenceEqual(b.Days ?? []);
}
