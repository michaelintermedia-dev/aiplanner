namespace AiPlanner.Application.Ai.Services;

/// <summary>
/// A short message is never cut in two (user's rule, 2026-10-10): "Call Anna
/// about the trip" must not become the title "Call Anna" with "About the trip"
/// as its details - a piece that means nothing on its own. The AI is told so;
/// this makes sure of it (pure, tested): when a message of a few words came back
/// as one item whose details are only a scrap of it, the whole message is the
/// title and the details are dropped. Longer details (a real thought) are kept.
/// </summary>
public static class ShortMessage
{
    public const int MaxMessageWords = 8;
    public const int MaxScrapWords = 4;

    public static NormalizedExtraction Fix(NormalizedExtraction extraction, string input)
    {
        if (extraction.Items.Count != 1) return extraction;
        var words = Words(input);
        if (words.Count == 0 || words.Count > MaxMessageWords) return extraction;
        var item = extraction.Items[0];
        var details = Words(item.Description);
        if (details.Count == 0 || details.Count > MaxScrapWords) return extraction;
        // Only a scrap OF the message (not new information the AI added).
        if (!details.All(d => words.Contains(d))) return extraction;

        var title = Whole(input);
        if (title.Length > ExtractionNormalizer.MaxTitleLength) return extraction;
        return extraction with { Items = [item with { Title = title, Description = null }] };
    }

    private static List<string> Words(string? text) =>
        (text ?? "").ToLowerInvariant()
            .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
            .Select(w => new string(w.Where(char.IsLetterOrDigit).ToArray()))
            .Where(w => w.Length > 0)
            .ToList();

    /// <summary>The message as a title: one line, no closing full stop, first letter capitalised.</summary>
    private static string Whole(string input)
    {
        var flat = string.Join(' ', input.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).TrimEnd('.', '!', ' ');
        return flat.Length == 0 ? flat : char.ToUpper(flat[0]) + flat[1..];
    }
}
