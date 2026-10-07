using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Ai.Services;

/// <summary>
/// "One entry per message" (Settings, on by default - user's rule, 2026-10-07):
/// whatever one recording or typed message holds becomes ONE item, never two
/// or three. The AI is asked for that; this makes sure of it (pure,
/// unit-tested): the main item - an event before a task before a note, the
/// first one on a tie - keeps its type, title, dates and reminders, and the
/// others become lines of its details, in the user's own words. Their
/// reminders come along: "before" ones turn into a fixed time (they belong to
/// the other item's time), others as they are. The whole recording is its
/// clip (no quote), and every question the AI asked is kept.
/// </summary>
public static class SingleEntry
{
    public static NormalizedExtraction Merge(NormalizedExtraction extraction)
    {
        if (extraction.Items.Count <= 1)
        {
            return extraction;
        }

        var main = extraction.Items
            .Select((item, index) => (item, index))
            .OrderBy(x => Rank(x.item.Intent))
            .ThenBy(x => x.index)
            .First().item;
        var others = extraction.Items.Where(i => !ReferenceEquals(i, main)).ToList();

        var lines = new List<string>();
        if (!string.IsNullOrWhiteSpace(main.Description)) lines.Add(main.Description.Trim());
        foreach (var other in others) lines.Add("• " + Describe(other));

        var reminders = main.Reminders.ToList();
        foreach (var other in others)
        {
            foreach (var reminder in other.Reminders)
            {
                if (Carried(reminder, other) is { } carried && !reminders.Contains(carried)) reminders.Add(carried);
            }
        }

        var questions = extraction.Items.Select(i => i.Clarification).OfType<string>().Distinct().ToList();
        var merged = main with
        {
            Description = string.Join("\n", lines),
            Reminders = reminders,
            Clarification = questions.Count > 0 ? string.Join(" ", questions) : null,
            Confidence = extraction.Items.Min(i => i.Confidence),
            SourceText = null,
        };
        return extraction with { Items = [merged] };
    }

    private static int Rank(ExtractionIntent intent) => intent switch
    {
        ExtractionIntent.Appointment => 0,
        ExtractionIntent.Task or ExtractionIntent.Reminder => 1,
        _ => 2,
    };

    /// <summary>The other item in the user's own words when there are any, else its title and details.</summary>
    private static string Describe(NormalizedItem item)
    {
        if (!string.IsNullOrWhiteSpace(item.SourceText)) return item.SourceText.Trim();
        var details = item.Description?.Trim();
        return string.IsNullOrEmpty(details) || details == item.Title ? item.Title : $"{item.Title}: {details}";
    }

    /// <summary>A reminder of another item, as it works on the main one (null: it can't).</summary>
    private static ReminderDto? Carried(ReminderDto reminder, NormalizedItem from)
    {
        if (reminder.Kind != ReminderKind.Before) return reminder;
        var at = from.StartUtc ?? from.DueUtc;
        return at is { } time && from.HasTime
            ? new ReminderDto(ReminderKind.At, AtUtc: time.AddMinutes(-(reminder.MinutesBefore ?? 0)))
            : null;
    }
}
