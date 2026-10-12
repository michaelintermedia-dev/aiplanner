using AiPlanner.Application.Auth.DTOs;
using AiPlanner.Application.Auth.Interfaces;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Models;
using AiPlanner.Application.Common.Utils;
using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AiPlanner.Application.Auth.Services;

public partial class AuthService : IAuthService
{
    private readonly IApplicationDbContext _db;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITokenService _tokenService;
    private readonly IDateTime _dateTime;
    private readonly RefreshTokenOptions _refreshOptions;
    private readonly IRegistrationPolicy _registration;
    private readonly IExternalTokenValidator _external;
    private readonly IEmailSender _email;

    public AuthService(
        IApplicationDbContext db,
        IPasswordHasher passwordHasher,
        ITokenService tokenService,
        IDateTime dateTime,
        IOptions<RefreshTokenOptions> refreshOptions,
        IRegistrationPolicy registration,
        IExternalTokenValidator external,
        IEmailSender email)
    {
        _email = email;
        _registration = registration;
        _external = external;
        _db = db;
        _passwordHasher = passwordHasher;
        _tokenService = tokenService;
        _dateTime = dateTime;
        _refreshOptions = refreshOptions.Value;
    }

    public async Task<Result<AuthResponse>> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (!_registration.IsAllowed(email))
        {
            return Result<AuthResponse>.Failure("Sign-up is by invitation only.");
        }

        var exists = await _db.Users.AnyAsync(u => u.Email == email, ct);
        if (exists)
        {
            return Result<AuthResponse>.Failure("An account with this email already exists.");
        }

        var user = new User
        {
            Email = email,
            DisplayName = request.DisplayName.Trim(),
            PasswordHash = _passwordHasher.Hash(request.Password),
            TimeZoneId = string.IsNullOrWhiteSpace(request.TimeZoneId) ? "UTC" : request.TimeZoneId!,
            Locale = LocaleHelper.IsValid(request.Locale) ? request.Locale! : "en-US",
            CreatedAtUtc = _dateTime.UtcNow,
            UpdatedAtUtc = _dateTime.UtcNow
        };

        user.Settings = new UserSettings { UserId = user.Id };

        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);
        // A code to confirm the address (when email is set up); the app shows where to type it.
        if (_email.IsConfigured) await SendCodeAsync(user, Domain.Enums.EmailCodePurpose.VerifyEmail, ct);

        return Result<AuthResponse>.Success(await IssueTokensAsync(user, deviceInfo: null, ct));
    }

    public async Task<Result<AuthResponse>> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user is not null && string.IsNullOrEmpty(user.PasswordHash))
        {
            // Made with Google/Apple: no password to check (and BCrypt can't read an empty hash).
            return Result<AuthResponse>.Failure("This account signs in with Google or Apple.");
        }
        if (user is null || !_passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            return Result<AuthResponse>.Failure("Invalid email or password.");
        }

        user.LastLoginAtUtc = _dateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Result<AuthResponse>.Success(await IssueTokensAsync(user, request.DeviceInfo, ct));
    }

    /// <summary>
    /// Sign in or up with Google/Apple (user's request, 2026-10-12): the provider's
    /// token is checked, then ExternalAccount decides which account it is.
    /// </summary>
    public async Task<Result<AuthResponse>> ExternalLoginAsync(ExternalLoginRequest request, CancellationToken ct = default)
    {
        var provider = request.Provider.Trim().ToLowerInvariant();
        var who = await _external.ValidateAsync(provider, request.IdToken, request.Nonce, ct);
        if (who is null)
        {
            return Result<AuthResponse>.Failure("Could not verify the sign-in. Please try again.");
        }

        var link = await _db.ExternalLogins.Include(l => l.User)
            .FirstOrDefaultAsync(l => l.Provider == who.Provider && l.Subject == who.Subject, ct);
        var email = who.Email?.Trim().ToLowerInvariant();
        var byEmail = link is null && email is not null ? await _db.Users.FirstOrDefaultAsync(u => u.Email == email, ct) : null;

        User user;
        switch (ExternalAccount.Decide(link is not null, email, who.EmailVerified, byEmail is not null))
        {
            case ExternalAccountAction.UseLinked:
                user = link!.User;
                if (user.IsDeleted) return Result<AuthResponse>.Failure("This account was deleted.");
                link.LastUsedAtUtc = _dateTime.UtcNow;
                break;
            case ExternalAccountAction.LinkExisting:
                user = byEmail!;
                if (user.IsDeleted) return Result<AuthResponse>.Failure("This account was deleted.");
                if (!user.EmailConfirmed)
                {
                    // Nobody had proven this inbox: someone else may have signed up with it and a
                    // password they know. The provider proves it's this person's - so that password
                    // and every session go; only the provider (or a reset by email) gets in now.
                    user.PasswordHash = string.Empty;
                    await RevokeAllAsync(user.Id, ct);
                    user.EmailConfirmed = true;
                }
                AddLink(user, who, email);
                break;
            case ExternalAccountAction.CreateNew:
                if (!_registration.IsAllowed(email!))
                {
                    return Result<AuthResponse>.Failure("Sign-up is by invitation only.");
                }
                user = new User
                {
                    Email = email!,
                    DisplayName = ExternalAccount.NameFor(request.DisplayName, who.Name, email!),
                    PasswordHash = string.Empty, // no password - signs in with the provider
                    EmailConfirmed = who.EmailVerified,
                    TimeZoneId = string.IsNullOrWhiteSpace(request.TimeZoneId) ? "UTC" : request.TimeZoneId!,
                    Locale = LocaleHelper.IsValid(request.Locale) ? request.Locale! : "en-US",
                    CreatedAtUtc = _dateTime.UtcNow,
                    UpdatedAtUtc = _dateTime.UtcNow,
                };
                user.Settings = new UserSettings { UserId = user.Id };
                _db.Users.Add(user);
                AddLink(user, who, email);
                break;
            case ExternalAccountAction.RefuseUnverifiedEmail:
                return Result<AuthResponse>.Failure("An account with this email already exists - sign in with your password.");
            default:
                return Result<AuthResponse>.Failure("The sign-in didn't share an email address.");
        }

        user.LastLoginAtUtc = _dateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Result<AuthResponse>.Success(await IssueTokensAsync(user, request.DeviceInfo, ct));
    }

    public ExternalProvidersDto ExternalProviders => _external.Providers with { EmailEnabled = _email.IsConfigured };

    private void AddLink(User user, ExternalIdentity who, string? email) =>
        _db.ExternalLogins.Add(new ExternalLogin
        {
            UserId = user.Id,
            Provider = who.Provider,
            Subject = who.Subject,
            Email = email,
            CreatedAtUtc = _dateTime.UtcNow,
            LastUsedAtUtc = _dateTime.UtcNow,
        });

    public async Task<Result<AuthResponse>> RefreshAsync(string refreshToken, CancellationToken ct = default)
    {
        var hash = _tokenService.HashToken(refreshToken);

        var existing = await _db.RefreshTokens
            .Include(rt => rt.User)
            .FirstOrDefaultAsync(rt => rt.TokenHash == hash, ct);

        if (existing is null || !existing.IsActive)
        {
            return Result<AuthResponse>.Failure("Invalid or expired refresh token.");
        }

        existing.RevokedAtUtc = _dateTime.UtcNow;

        var response = await IssueTokensAsync(existing.User, existing.DeviceInfo, ct);
        existing.ReplacedByTokenHash = _tokenService.HashToken(response.RefreshToken);

        await _db.SaveChangesAsync(ct);

        return Result<AuthResponse>.Success(response);
    }

    public async Task<Result> RevokeRefreshTokenAsync(string refreshToken, CancellationToken ct = default)
    {
        var hash = _tokenService.HashToken(refreshToken);
        var existing = await _db.RefreshTokens.FirstOrDefaultAsync(rt => rt.TokenHash == hash, ct);

        if (existing is null)
        {
            return Result.Failure("Token not found.");
        }

        existing.RevokedAtUtc = _dateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Result.Success();
    }

    private async Task<AuthResponse> IssueTokensAsync(User user, string? deviceInfo, CancellationToken ct)
    {
        var accessToken = _tokenService.GenerateAccessToken(user);
        var refreshTokenPlain = _tokenService.GenerateRefreshToken();

        var refreshToken = new RefreshToken
        {
            UserId = user.Id,
            TokenHash = _tokenService.HashToken(refreshTokenPlain),
            ExpiresAtUtc = _dateTime.UtcNow.AddDays(_refreshOptions.RefreshTokenDays),
            DeviceInfo = deviceInfo
        };

        _db.RefreshTokens.Add(refreshToken);
        await _db.SaveChangesAsync(ct);

        return new AuthResponse(
            user.Id,
            user.Email,
            user.DisplayName,
            accessToken,
            _dateTime.UtcNow.AddMinutes(_refreshOptions.AccessTokenMinutes),
            refreshTokenPlain);
    }
}

public class RefreshTokenOptions
{
    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 30;
}
