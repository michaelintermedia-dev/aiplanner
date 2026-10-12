using System.Text.RegularExpressions;

namespace AiPlanner.Application.Ai.Services;

/// <summary>
/// Web links in what the user typed or shared (pure - unit tested): found the
/// same way as the apps' linkify, and never lost - an entry made from words with
/// links keeps every link in its text, exactly as written, so it stays clickable.
/// </summary>
public static partial class Links
{
    public const int MaxLookups = 3;

    [GeneratedRegex(@"\b(?:https?://|www\.)[^\s<>""']+", RegexOptions.IgnoreCase)]
    private static partial Regex Link();

    private static readonly char[] Trailing = ['.', ',', ';', ':', '!', '?', ')', ']', '}', '\'', '"', '»', '”', '’'];

    /// <summary>The links in the text, in order, without duplicates ("www." ones get https://).</summary>
    public static IReadOnlyList<string> Find(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return [];
        var found = new List<string>();
        foreach (Match m in Link().Matches(text))
        {
            var raw = m.Value;
            // A closing bracket belongs to the link when it opened inside it (Wikipedia-style).
            while (raw.Length > 0 && Trailing.Contains(raw[^1]) && !(raw[^1] == ')' && raw.Count(c => c == '(') >= raw.Count(c => c == ')')))
            {
                raw = raw[..^1];
            }
            if (raw.Length == 0) continue;
            var url = raw.StartsWith("www.", StringComparison.OrdinalIgnoreCase) ? "https://" + raw : raw;
            if (!found.Contains(url, StringComparer.Ordinal)) found.Add(url);
        }
        return found;
    }

    /// <summary>The links as written in the text (for keeping them), not with https:// added.</summary>
    public static IReadOnlyList<string> AsWritten(string? text) =>
        Find(text).Select(u => text!.Contains(u, StringComparison.Ordinal) ? u : u["https://".Length..]).ToList();

    /// <summary>
    /// Every link from the user's words is in the entry: a link the AI dropped goes
    /// back on a line of its own at the end of the first item's description.
    /// </summary>
    public static NormalizedExtraction Keep(NormalizedExtraction extraction, string? userText)
    {
        var links = AsWritten(userText);
        if (links.Count == 0 || extraction.Items.Count == 0) return extraction;
        var all = string.Join("\n", extraction.Items.SelectMany(i => new[] { i.Title, i.Description ?? "" }));
        var missing = links.Where(l => !all.Contains(l, StringComparison.Ordinal)).ToList();
        if (missing.Count == 0) return extraction;
        var first = extraction.Items[0];
        var description = string.IsNullOrWhiteSpace(first.Description) ? string.Join("\n", missing) : first.Description.TrimEnd() + "\n" + string.Join("\n", missing);
        return extraction with { Items = [first with { Description = description }, .. extraction.Items.Skip(1)] };
    }
}
