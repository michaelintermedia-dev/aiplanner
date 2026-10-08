using AiPlanner.Application.Ai.Interfaces;

namespace AiPlanner.Application.Ai.Services;

/// <summary>
/// "Find ..." said or typed in the capture bar: instead of new items, the AI
/// returns what to look for, and the app opens the feed with those filters.
/// Values use the feed filter's own words (shared/feedFilter.ts), so the
/// clients only copy them over. Kinds: Task / Appointment / Note; When:
/// today / week / overdue / nodate; Status: Open / Done; Reminders: With /
/// Repeating / Without.
/// </summary>
public record FeedSearch(
    string? Text,
    IReadOnlyList<string> Tags,
    IReadOnlyList<string> Kinds,
    string? When,
    string? Status,
    string? Reminders,
    bool FromVoice)
{
    public const int MaxTextLength = 100;

    /// <summary>
    /// The AI's search, validated (pure, tested): unknown values are dropped.
    /// Tags it names are looked for as words like the rest (user's rule: a
    /// voice search uses every text - title, body, tags, people, media
    /// descriptions, the words it was captured from), so a word counts
    /// wherever it is. Words already in the text aren't added twice.
    /// </summary>
    public static FeedSearch From(RawSearch raw, IReadOnlyList<string> knownTags)
    {
        var words = (raw.Text ?? "").Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).ToList();
        foreach (var name in (raw.Tags ?? []).Select(t => t.Trim().TrimStart('#')).Where(t => t.Length > 0))
        {
            if (!words.Any(w => w.Equals(name, StringComparison.OrdinalIgnoreCase))) words.Add(name);
        }
        var text = string.Join(' ', words);
        IReadOnlyList<string> tags = [];
        var kinds = (raw.Kinds ?? [])
            .Select(k => k.Trim().ToLowerInvariant() switch
            {
                "task" => "Task",
                "appointment" or "event" => "Appointment",
                "note" => "Note",
                _ => null,
            })
            .OfType<string>().Distinct().ToList();
        return new FeedSearch(
            string.IsNullOrEmpty(text) ? null : text.Length > MaxTextLength ? text[..MaxTextLength].Trim() : text,
            tags,
            kinds.Count == 3 ? [] : kinds,
            Pick(raw.When, "today", "week", "overdue", "nodate"),
            Pick(raw.Status, "Open", "Done"),
            Pick(raw.Reminders, "With", "Repeating", "Without"),
            raw.FromVoice == true);
    }

    /// <summary>The allowed value it matches (ignoring case), in the allowed spelling.</summary>
    private static string? Pick(string? value, params string[] allowed) =>
        allowed.FirstOrDefault(a => a.Equals(value?.Trim(), StringComparison.OrdinalIgnoreCase));
}
