using System.Security.Cryptography;
using System.Text;
using AiPlanner.Application.Auth.DTOs;
using AiPlanner.Application.Auth.Interfaces;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace AiPlanner.Infrastructure.Identity;

/// <summary>
/// Checks Google and Apple ID tokens against each provider's published signing
/// keys (OpenID Connect discovery, cached and refreshed by ConfigurationManager):
/// issuer, audience (our client ids), lifetime and signature; then the nonce.
/// </summary>
public class OidcExternalTokenValidator : IExternalTokenValidator
{
    private sealed record Provider(string Name, string[] Issuers, IReadOnlyList<string> Audiences, ConfigurationManager<OpenIdConnectConfiguration> Keys);

    private readonly Dictionary<string, Provider> _providers = new(StringComparer.OrdinalIgnoreCase);
    private readonly ExternalAuthOptions _options;
    private readonly bool _testProvider;
    private readonly ILogger<OidcExternalTokenValidator> _logger;
    private readonly JsonWebTokenHandler _handler = new();

    public OidcExternalTokenValidator(IOptions<ExternalAuthOptions> options, IHostEnvironment env, ILogger<OidcExternalTokenValidator> logger)
    {
        _options = options.Value;
        _logger = logger;
        _testProvider = _options.AllowTestProvider && env.IsDevelopment();

        var google = ExternalAuthOptions.Ids(_options.Google.WebClientId, _options.Google.OtherClientIds);
        if (google.Count > 0)
        {
            _providers["google"] = new Provider("google", ["https://accounts.google.com", "accounts.google.com"], google,
                Discovery("https://accounts.google.com/.well-known/openid-configuration"));
        }
        var apple = ExternalAuthOptions.Ids(_options.Apple.ServicesId, _options.Apple.BundleId);
        if (apple.Count > 0)
        {
            _providers["apple"] = new Provider("apple", ["https://appleid.apple.com"], apple,
                Discovery("https://appleid.apple.com/.well-known/openid-configuration"));
        }
    }

    public ExternalProvidersDto Providers => new(
        GoogleClientId: Blank(_options.Google.WebClientId),
        AppleServicesId: Blank(_options.Apple.ServicesId) is { } id && Blank(_options.Apple.RedirectUri) is not null ? id : null,
        AppleRedirectUri: Blank(_options.Apple.ServicesId) is not null ? Blank(_options.Apple.RedirectUri) : null,
        AppleNative: Blank(_options.Apple.BundleId) is not null);

    public async Task<ExternalIdentity?> ValidateAsync(string provider, string idToken, string? nonce, CancellationToken ct = default)
    {
        if (_testProvider && provider == "test") return TestIdentity(idToken);
        if (!_providers.TryGetValue(provider, out var p)) return null;

        try
        {
            var config = await p.Keys.GetConfigurationAsync(ct);
            var result = await _handler.ValidateTokenAsync(idToken, new TokenValidationParameters
            {
                ValidIssuers = p.Issuers,
                ValidAudiences = p.Audiences,
                IssuerSigningKeys = config.SigningKeys,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromMinutes(2),
            });
            if (!result.IsValid)
            {
                // A key rotation: fetch the keys again once, then give up.
                if (result.Exception is SecurityTokenSignatureKeyNotFoundException) p.Keys.RequestRefresh();
                _logger.LogInformation("External sign-in token refused ({Provider}): {Reason}", p.Name, result.Exception?.GetType().Name);
                return null;
            }

            var claims = result.Claims;
            if (!string.IsNullOrEmpty(nonce) && claims.TryGetValue("nonce", out var n) && !NonceMatches(n?.ToString(), nonce))
            {
                _logger.LogInformation("External sign-in token refused ({Provider}): nonce", p.Name);
                return null;
            }
            var subject = claims.TryGetValue("sub", out var sub) ? sub?.ToString() : null;
            if (string.IsNullOrEmpty(subject)) return null;
            var email = claims.TryGetValue("email", out var e) ? e?.ToString() : null;
            var verified = claims.TryGetValue("email_verified", out var v) && (v is true || string.Equals(v?.ToString(), "true", StringComparison.OrdinalIgnoreCase));
            var name = claims.TryGetValue("name", out var nm) ? nm?.ToString() : null;
            return new ExternalIdentity(p.Name, subject, email, verified, name);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "External sign-in check failed ({Provider})", p.Name);
            return null;
        }
    }

    /// <summary>The token carries the nonce as given, or its SHA-256 (Apple's native flow hashes it).</summary>
    private static bool NonceMatches(string? inToken, string sent)
    {
        if (inToken is null) return false;
        if (inToken == sent) return true;
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(sent))).ToLowerInvariant();
        return string.Equals(inToken, hash, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>"test|subject|email|name" - local QA only (see AllowTestProvider).</summary>
    private static ExternalIdentity? TestIdentity(string token)
    {
        var parts = token.Split('|');
        return parts.Length >= 3 && parts[0] == "test" && parts[1].Length > 0
            ? new ExternalIdentity("test", parts[1], parts[2].Length > 0 ? parts[2] : null, EmailVerified: true, parts.Length > 3 ? parts[3] : null)
            : null;
    }

    private static ConfigurationManager<OpenIdConnectConfiguration> Discovery(string url) =>
        new(url, new OpenIdConnectConfigurationRetriever(), new HttpDocumentRetriever { RequireHttps = true });

    private static string? Blank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
