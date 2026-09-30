namespace AiPlanner.Application.Common.Exceptions;

/// <summary>
/// The external AI or speech-to-text provider failed (network error, timeout,
/// rejected request, unusable response). Surfaced to clients as 502 with a
/// generic message; details are logged, never returned (spec section 36).
/// </summary>
public class AiProviderException : Exception
{
    public AiProviderException(string message, Exception? innerException = null)
        : base(message, innerException)
    {
    }
}
