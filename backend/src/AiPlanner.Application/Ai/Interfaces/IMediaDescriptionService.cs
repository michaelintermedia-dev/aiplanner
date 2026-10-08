namespace AiPlanner.Application.Ai.Interfaces;

/// <summary>
/// A short description of an attached photo or document for search: what it
/// is, then its key facts and readable text. Provider-agnostic (OpenAI in
/// Infrastructure); callers only pass what MediaReader could read.
/// </summary>
public interface IMediaDescriptionService
{
    /// <exception cref="Common.Exceptions.AiProviderException">The provider failed.</exception>
    Task<string> DescribeAsync(MediaInput media, string locale, CancellationToken ct = default);
}
