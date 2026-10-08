namespace AiPlanner.Application.Common.Interfaces;

/// <summary>
/// Compresses stored recordings: uncompressed uploads (WAV from the web app)
/// are re-encoded after transcription, roughly ten times smaller. Optional:
/// without an encoder it returns null and the original is kept.
/// </summary>
public interface IAudioCompressor
{
    /// <summary>The compressed audio and its file extension (e.g. ".m4a"), or null to keep the original.</summary>
    Task<(byte[] Audio, string Extension)?> CompressAsync(Stream audio, string extension, CancellationToken ct = default);
}
