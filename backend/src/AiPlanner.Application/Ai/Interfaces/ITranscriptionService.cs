namespace AiPlanner.Application.Ai.Interfaces;

/// <summary>Speech-to-text, provider-agnostic (spec section 16).</summary>
public interface ITranscriptionService
{
    /// <exception cref="Common.Exceptions.AiProviderException">The provider failed.</exception>
    Task<TranscriptionResult> TranscribeAsync(Stream audio, string fileName, string? mimeType, CancellationToken ct = default);
}

/// <param name="Words">
/// When each word was spoken, if the provider could tell (null otherwise). Used
/// only to find each item's part of the recording; the text comes from
/// <paramref name="Text"/>, which may differ slightly.
/// </param>
/// <param name="DurationMs">Length of this audio, when known.</param>
public record TranscriptionResult(
    string Text, string? LanguageCode, string ProviderName, IReadOnlyList<TimedWord>? Words = null, int? DurationMs = null);

/// <summary>One spoken word and when it was said, in ms from the start of its audio file.</summary>
public record TimedWord(string Word, int StartMs, int EndMs);
