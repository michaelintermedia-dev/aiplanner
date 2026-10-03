using System.Globalization;
using System.Text;
using AiPlanner.Application.Ai.Interfaces;

namespace AiPlanner.Application.Captures.Services;

/// <summary>
/// Finds the part of a recording each captured item came from, so an item can
/// play just its own words instead of the whole message. The AI quotes the
/// words an item came from; this matches the quote against word timestamps.
/// The quote comes from one transcription model and the timings from another,
/// so the match is fuzzy (local alignment that tolerates small differences).
/// Pure logic - unit tested.
/// </summary>
public static class AudioSnippets
{
    private const int LeadInMs = 250;
    public const int TailMs = 450;
    private const int MaxQuoteTokens = 400;

    /// <summary>
    /// All parts' words on one timeline (ms from the start of the whole
    /// recording, parts back to back), starting at <paramref name="offsetMs"/>.
    /// Null when any part has no timings - its length is unknown, so nothing
    /// after it could be placed.
    /// </summary>
    public static (List<TimedWord> Words, List<int> PartDurationsMs)? Timeline(IReadOnlyList<TranscriptionResult> parts, int offsetMs = 0)
    {
        var words = new List<TimedWord>();
        var durations = new List<int>();
        var offset = offsetMs;
        foreach (var part in parts)
        {
            if (part.Words is null) return null;
            var duration = part.DurationMs ?? (part.Words.Count > 0 ? part.Words[^1].EndMs : (int?)null);
            if (duration is null) return null;
            words.AddRange(part.Words.Select(w => w with { StartMs = w.StartMs + offset, EndMs = w.EndMs + offset }));
            durations.Add(duration.Value);
            offset += duration.Value;
        }
        return (words, durations);
    }

    /// <summary>
    /// Where <paramref name="quote"/> was said, as [start, end) ms on the
    /// timeline, with a little air around it; null if it can't be found.
    /// Words said twice: an equally good match from <paramref name="notBeforeMs"/>
    /// on wins (items come in the order they were said, so the previous item's
    /// end is passed - a repeated phrase then finds its own place, not the first).
    /// </summary>
    public static (int StartMs, int EndMs)? Find(string? quote, IReadOnlyList<TimedWord> timeline, int totalMs, int notBeforeMs = 0)
    {
        var q = Tokens(quote).Take(MaxQuoteTokens).ToList();
        if (q.Count == 0 || timeline.Count == 0) return null;
        var w = timeline.Select(t => Normalize(t.Word)).ToList();

        // Smith-Waterman over tokens: match +2, mismatch/gap -1.
        int m = q.Count, n = w.Count;
        var score = new int[m + 1, n + 1];
        var start = new int[m + 1, n + 1];
        int best = 0, bestI = 0, bestJ = 0;
        int later = 0, laterI = 0, laterJ = 0; // the best one starting at notBeforeMs or after
        for (var i = 1; i <= m; i++)
        {
            for (var j = 1; j <= n; j++)
            {
                var diag = score[i - 1, j - 1] + (Same(q[i - 1], w[j - 1]) ? 2 : -1);
                var up = score[i - 1, j] - 1;
                var left = score[i, j - 1] - 1;
                var s = Math.Max(0, Math.Max(diag, Math.Max(up, left)));
                score[i, j] = s;
                if (s == 0)
                {
                    start[i, j] = j; // a fresh alignment would start at word j-1 (0-based)
                    continue;
                }
                start[i, j] = s == diag ? (score[i - 1, j - 1] == 0 ? j - 1 : start[i - 1, j - 1])
                    : s == up ? start[i - 1, j]
                    : start[i, j - 1];
                if (s > best)
                {
                    (best, bestI, bestJ) = (s, i, j);
                }
                if (s > later && timeline[Math.Clamp(start[i, j], 0, j - 1)].StartMs >= notBeforeMs)
                {
                    (later, laterI, laterJ) = (s, i, j);
                }
            }
        }

        if (later == best && notBeforeMs > 0)
        {
            (bestI, bestJ) = (laterI, laterJ);
        }

        // Enough of the quote must be there: worth about half its words.
        if (best < Math.Max(2, 2 * (int)Math.Ceiling(q.Count * 0.5)))
        {
            return null;
        }
        var bestEnd = bestJ - 1;
        var bestStart = Math.Clamp(start[bestI, bestJ], 0, bestEnd);

        var from = Math.Max(0, timeline[bestStart].StartMs - LeadInMs);
        var to = Math.Min(totalMs, timeline[bestEnd].EndMs + TailMs);
        return to > from ? (from, to) : null;
    }

    private static IEnumerable<string> Tokens(string? text) =>
        (text ?? "").Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).Select(Normalize).Where(t => t.Length > 0);

    /// <summary>Lower case, letters and digits only ("Friday," -> "friday", "ё" kept).</summary>
    private static string Normalize(string word)
    {
        var sb = new StringBuilder(word.Length);
        foreach (var ch in word.Normalize(NormalizationForm.FormC))
        {
            if (char.IsLetterOrDigit(ch)) sb.Append(char.ToLower(ch, CultureInfo.InvariantCulture));
        }
        return sb.ToString().Replace('ё', 'е');
    }

    /// <summary>The same word, allowing for small spelling differences between models.</summary>
    private static bool Same(string a, string b)
    {
        if (a.Length == 0 || b.Length == 0) return false;
        if (a == b) return true;
        var shorter = Math.Min(a.Length, b.Length);
        if (shorter >= 4 && (a.StartsWith(b, StringComparison.Ordinal) || b.StartsWith(a, StringComparison.Ordinal))) return true;
        return shorter >= 4 && Distance(a, b) <= (shorter >= 8 ? 2 : 1);
    }

    private static int Distance(string a, string b)
    {
        var prev = new int[b.Length + 1];
        var cur = new int[b.Length + 1];
        for (var j = 0; j <= b.Length; j++) prev[j] = j;
        for (var i = 1; i <= a.Length; i++)
        {
            cur[0] = i;
            for (var j = 1; j <= b.Length; j++)
            {
                cur[j] = Math.Min(Math.Min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1));
            }
            (prev, cur) = (cur, prev);
        }
        return prev[b.Length];
    }
}
