namespace AiPlanner.Application.Common.Interfaces;

/// <summary>
/// Audio tooling for stored recordings. Compress: uncompressed uploads (WAV
/// from the web app) are re-encoded after transcription, roughly ten times
/// smaller. Cut: keep only some stretches (shortening long pauses) of a
/// compressed file - WAV is cut without it (PauseTrimmer.CutWav). Both are
/// optional: without an encoder they return null and the original is kept.
/// </summary>
public interface IAudioCompressor
{
    /// <summary>The compressed audio and its file extension (e.g. ".m4a"), or null to keep the original.</summary>
    Task<(byte[] Audio, string Extension)?> CompressAsync(Stream audio, string extension, CancellationToken ct = default);

    /// <summary>The audio with only the [start, end) ms stretches kept, in the same format, or null.</summary>
    Task<byte[]?> CutAsync(Stream audio, string extension, IReadOnlyList<(int StartMs, int EndMs)> keep, CancellationToken ct = default);
}
