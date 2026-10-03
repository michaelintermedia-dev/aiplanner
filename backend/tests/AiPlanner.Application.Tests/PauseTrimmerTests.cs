using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Captures.Services;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class PauseTrimmerTests
{
    private static TimedWord W(int start, int end) => new("w", start, end);

    [Fact]
    public void Short_pauses_are_left_alone()
    {
        // Gaps of 0.1-0.2 s are ordinary speech, not pauses.
        PauseTrimmer.Plan([W(100, 600), W(800, 1400), W(1600, 2500)], 2700).Should().BeNull();
    }

    [Fact]
    public void Pauses_shrink_to_a_short_gap_and_edges_are_trimmed()
    {
        // 3 s of silence before speaking, a 4 s pause, and 2.5 s of silence at the end.
        var words = new[] { W(3000, 3500), W(3600, 4000), W(8000, 8500) };

        var keep = PauseTrimmer.Plan(words, 11_000)!;

        keep.Should().Equal(
            new PauseTrimmer.Segment(2850, 4075), // 0.15 s lead-in, then until 0.075 s after "4000"
            new PauseTrimmer.Segment(7925, 8650)); // from 0.075 s before "8000" to 0.15 s after the end
        keep.Sum(s => s.Length).Should().Be(1950);
    }

    [Fact]
    public void A_pause_between_sentences_is_shortened_too()
    {
        // 0.5 s between two sentences: cut to 0.15 s.
        var keep = PauseTrimmer.Plan([W(0, 900), W(1400, 2000)], 2000)!;

        keep.Sum(s => s.Length).Should().Be(2000 - (500 - PauseTrimmer.KeptPauseMs));
    }

    [Fact]
    public void Timings_move_with_the_cuts()
    {
        var part = new TranscriptionResult("t", null, "p", [W(3000, 3500), W(3600, 4000), W(8000, 8500)], 11_000);
        var keep = PauseTrimmer.Plan(part.Words!, 11_000)!;

        var trimmed = PauseTrimmer.Apply(part, keep);

        trimmed.DurationMs.Should().Be(1950);
        trimmed.Words!.Select(w => (w.StartMs, w.EndMs)).Should().Equal((150, 650), (750, 1150), (1300, 1800));
        // The pause between "4000" and "8000" is now 0.15 s long.
        (trimmed.Words![2].StartMs - trimmed.Words[1].EndMs).Should().Be(PauseTrimmer.KeptPauseMs);
    }

    [Fact]
    public void A_wav_is_cut_to_the_kept_stretches()
    {
        // 16 kHz mono 16-bit, 2 s; sample value = its millisecond, so the cut is checkable.
        var samples = Enumerable.Range(0, 32_000).Select(i => (short)(i / 16)).ToArray();
        var wav = new byte[44 + samples.Length * 2];
        void Text(int o, string s) => System.Text.Encoding.ASCII.GetBytes(s).CopyTo(wav, o);
        Text(0, "RIFF"); BitConverter.GetBytes(36 + samples.Length * 2).CopyTo(wav, 4); Text(8, "WAVE"); Text(12, "fmt ");
        BitConverter.GetBytes(16).CopyTo(wav, 16); BitConverter.GetBytes((short)1).CopyTo(wav, 20); BitConverter.GetBytes((short)1).CopyTo(wav, 22);
        BitConverter.GetBytes(16000).CopyTo(wav, 24); BitConverter.GetBytes(32000).CopyTo(wav, 28); BitConverter.GetBytes((short)2).CopyTo(wav, 32);
        BitConverter.GetBytes((short)16).CopyTo(wav, 34); Text(36, "data"); BitConverter.GetBytes(samples.Length * 2).CopyTo(wav, 40);
        Buffer.BlockCopy(samples, 0, wav, 44, samples.Length * 2);

        var cut = PauseTrimmer.CutWav(wav, [new(100, 300), new(1500, 1600)])!;

        BitConverter.ToInt32(cut, 40).Should().Be((200 + 100) * 16 * 2);
        BitConverter.ToInt16(cut, 44).Should().Be(100); // starts at 100 ms
        BitConverter.ToInt16(cut, 44 + 200 * 32).Should().Be(1500); // jumps to 1500 ms
        PauseTrimmer.CutWav([1, 2, 3], [new(0, 1)]).Should().BeNull();
    }
}
