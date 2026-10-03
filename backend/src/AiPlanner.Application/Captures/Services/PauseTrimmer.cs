using AiPlanner.Application.Ai.Interfaces;

namespace AiPlanner.Application.Captures.Services;

/// <summary>
/// "Shorten long pauses": cuts silences longer than <see cref="MaxPauseMs"/>
/// down to <see cref="KeptPauseMs"/>. The pauses come from the word timings
/// (not from loudness), so the same cut list moves the timings too and each
/// item's snippet still lands on its words. Pure - unit tested.
/// </summary>
public static class PauseTrimmer
{
    public const int MaxPauseMs = 1000;
    /// <summary>What's left of a long pause - enough to still sound like one.</summary>
    public const int KeptPauseMs = 400;

    /// <summary>A stretch of the original audio to keep, [StartMs, EndMs).</summary>
    public record Segment(int StartMs, int EndMs)
    {
        public int Length => EndMs - StartMs;
    }

    /// <summary>The stretches to keep, or null when nothing needs cutting.</summary>
    public static IReadOnlyList<Segment>? Plan(IReadOnlyList<TimedWord> words, int durationMs)
    {
        if (words.Count == 0 || durationMs <= 0) return null;
        var half = KeptPauseMs / 2;
        var keep = new List<Segment>();
        var start = 0;

        // Silence before the first word, between words, and after the last one.
        var gaps = new List<(int From, int To)> { (0, words[0].StartMs) };
        for (var i = 1; i < words.Count; i++) gaps.Add((words[i - 1].EndMs, words[i].StartMs));
        gaps.Add((words[^1].EndMs, durationMs));

        for (var g = 0; g < gaps.Count; g++)
        {
            var (from, to) = gaps[g];
            if (to - from <= MaxPauseMs) continue;
            var first = g == 0;
            var last = g == gaps.Count - 1;
            // Keep a little of the pause at each side (only after the end / before the start at the edges).
            var cutFrom = first ? 0 : from + (last ? KeptPauseMs : half);
            var cutTo = last ? durationMs : to - (first ? KeptPauseMs : half);
            if (cutTo <= cutFrom) continue;
            if (cutFrom > start) keep.Add(new Segment(start, cutFrom));
            start = cutTo;
        }
        if (start == 0 && keep.Count == 0) return null; // no long pauses
        if (durationMs > start) keep.Add(new Segment(start, durationMs));
        return keep;
    }

    /// <summary>Where an original moment ends up after cutting (inside a cut -> the cut point).</summary>
    public static int Map(IReadOnlyList<Segment> keep, int ms)
    {
        var offset = 0;
        foreach (var s in keep)
        {
            if (ms < s.StartMs) return offset;
            if (ms <= s.EndMs) return offset + (ms - s.StartMs);
            offset += s.Length;
        }
        return offset;
    }

    /// <summary>The part's words and length after cutting.</summary>
    public static TranscriptionResult Apply(TranscriptionResult part, IReadOnlyList<Segment> keep) => part with
    {
        Words = part.Words?.Select(w => w with { StartMs = Map(keep, w.StartMs), EndMs = Map(keep, w.EndMs) }).ToList(),
        DurationMs = keep.Sum(s => s.Length),
    };

    /// <summary>
    /// Cuts a PCM WAV file to the kept stretches; null if it isn't plain PCM WAV.
    /// (Other formats are cut by the audio tool, see IAudioCompressor.)
    /// </summary>
    public static byte[]? CutWav(byte[] wav, IReadOnlyList<Segment> keep)
    {
        if (wav.Length < 44 || wav[0] != 'R' || wav[1] != 'I' || wav[2] != 'F' || wav[3] != 'F' || wav[8] != 'W' || wav[9] != 'A') return null;
        int? channels = null, sampleRate = null, bits = null, dataAt = null, dataLength = null;
        var at = 12;
        while (at + 8 <= wav.Length)
        {
            var id = System.Text.Encoding.ASCII.GetString(wav, at, 4);
            var size = BitConverter.ToInt32(wav, at + 4);
            if (id == "fmt ")
            {
                if (BitConverter.ToInt16(wav, at + 8) != 1) return null; // not PCM
                channels = BitConverter.ToInt16(wav, at + 10);
                sampleRate = BitConverter.ToInt32(wav, at + 12);
                bits = BitConverter.ToInt16(wav, at + 22);
            }
            else if (id == "data")
            {
                dataAt = at + 8;
                dataLength = Math.Min(size, wav.Length - dataAt.Value);
                break;
            }
            at += 8 + size + (size & 1);
        }
        if (channels is not { } ch || sampleRate is not { } rate || bits is not { } b || dataAt is not { } data || dataLength is not { } length) return null;

        var frame = ch * b / 8;
        var output = new MemoryStream();
        foreach (var s in keep)
        {
            var from = (int)Math.Min(length, (long)s.StartMs * rate / 1000 * frame);
            var to = (int)Math.Min(length, (long)s.EndMs * rate / 1000 * frame);
            if (to > from) output.Write(wav, data + from, to - from);
        }
        var pcm = output.ToArray();

        var result = new byte[44 + pcm.Length];
        void Text(int offset, string s) => System.Text.Encoding.ASCII.GetBytes(s).CopyTo(result, offset);
        Text(0, "RIFF");
        BitConverter.GetBytes(36 + pcm.Length).CopyTo(result, 4);
        Text(8, "WAVE");
        Text(12, "fmt ");
        BitConverter.GetBytes(16).CopyTo(result, 16);
        BitConverter.GetBytes((short)1).CopyTo(result, 20);
        BitConverter.GetBytes((short)ch).CopyTo(result, 22);
        BitConverter.GetBytes(rate).CopyTo(result, 24);
        BitConverter.GetBytes(rate * frame).CopyTo(result, 28);
        BitConverter.GetBytes((short)frame).CopyTo(result, 32);
        BitConverter.GetBytes((short)b).CopyTo(result, 34);
        Text(36, "data");
        BitConverter.GetBytes(pcm.Length).CopyTo(result, 40);
        pcm.CopyTo(result, 44);
        return result;
    }
}
