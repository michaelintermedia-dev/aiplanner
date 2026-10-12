namespace AiPlanner.Application.Auth.DTOs;

/// <summary>
/// Sign in (or up) with Google or Apple: the provider's ID token, plus what a
/// new account needs. DisplayName: Apple gives the name only to the app, once.
/// </summary>
public record ExternalLoginRequest(
    string Provider,
    string IdToken,
    string? Nonce = null,
    string? DisplayName = null,
    string? TimeZoneId = null,
    string? Locale = null,
    string? DeviceInfo = null);
