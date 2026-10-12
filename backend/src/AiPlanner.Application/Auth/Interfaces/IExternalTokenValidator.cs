using AiPlanner.Application.Auth.DTOs;

namespace AiPlanner.Application.Auth.Interfaces;

/// <summary>
/// Checks a sign-in token from Google or Apple: signed by the provider, meant
/// for this app (one of the configured client ids), not expired, and with the
/// nonce the client sent (when it sent one). Implemented in Infrastructure.
/// </summary>
public interface IExternalTokenValidator
{
    /// <returns>Who it is, or null when the token can't be trusted or the provider isn't set up.</returns>
    Task<ExternalIdentity?> ValidateAsync(string provider, string idToken, string? nonce, CancellationToken ct = default);

    /// <summary>What the sign-in screens need to show the buttons (null = that provider isn't set up).</summary>
    ExternalProvidersDto Providers { get; }
}

/// <param name="Provider">"google" or "apple".</param>
/// <param name="Subject">The provider's id for the person.</param>
/// <param name="EmailVerified">The provider vouches that the email is theirs.</param>
public record ExternalIdentity(string Provider, string Subject, string? Email, bool EmailVerified, string? Name);
