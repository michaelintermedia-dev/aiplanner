namespace AiPlanner.Application.Feed.Services;

/// <summary>
/// How well an item matches the search words (pure - unit tested; filters,
/// 2026-10-13). Every listed item already has every word somewhere (title,
/// text, tags, photos, what was said); this ranks them: the whole phrase in the
/// title first, then each word in the title, a title that starts with the first word.
/// </summary>
public static class FeedRelevance
{
    public static int Score(string? title, IReadOnlyList<string> words)
    {
        if (words.Count == 0 || string.IsNullOrWhiteSpace(title)) return 0;
        var t = title.ToLowerInvariant();
        var score = 0;
        foreach (var w in words)
        {
            if (t.Contains(w, StringComparison.Ordinal)) score += 10;
        }
        if (words.Count > 1 && t.Contains(string.Join(' ', words), StringComparison.Ordinal)) score += 15;
        if (t.StartsWith(words[0], StringComparison.Ordinal)) score += 5;
        if (t == string.Join(' ', words)) score += 5;
        return score;
    }
}
