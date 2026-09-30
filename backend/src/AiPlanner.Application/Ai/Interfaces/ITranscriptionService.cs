namespace AiPlanner.Application.Ai.Interfaces;

/// <summary>Speech-to-text, provider-agnostic (spec section 16).</summary>
public interface ITranscriptionService
{
    /// <exception cref="Common.Exceptions.AiProviderException">The provider failed.</exception>
    Task<TranscriptionResult> TranscribeAsync(Stream audio, string fileName, string? mimeType, CancellationToken ct = default);
}

public record TranscriptionResult(string Text, string? LanguageCode, string ProviderName);
