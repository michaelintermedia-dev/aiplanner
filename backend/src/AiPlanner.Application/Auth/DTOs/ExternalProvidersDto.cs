namespace AiPlanner.Application.Auth.DTOs;

/// <summary>
/// Which "Sign in with ..." buttons to show, and the public ids they need
/// (GET /api/auth/providers - nothing secret here). Null = not set up.
/// </summary>
/// <param name="GoogleClientId">The web OAuth client id (the web button, and the phone's webClientId).</param>
/// <param name="AppleServicesId">The Services ID for Sign in with Apple on the web.</param>
/// <param name="AppleRedirectUri">The return URL registered for that Services ID.</param>
/// <param name="AppleNative">Sign in with Apple on iPhone (the app's bundle id is configured).</param>
/// <param name="EmailEnabled">The server sends email: "Forgot password?" and email confirmation are on.</param>
public record ExternalProvidersDto(string? GoogleClientId, string? AppleServicesId, string? AppleRedirectUri, bool AppleNative, bool EmailEnabled = false);
