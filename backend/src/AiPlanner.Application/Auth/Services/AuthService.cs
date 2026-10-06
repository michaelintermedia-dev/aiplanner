using AiPlanner.Application.Auth.DTOs;
using AiPlanner.Application.Auth.Interfaces;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Models;
using AiPlanner.Application.Common.Utils;
using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AiPlanner.Application.Auth.Services;

public class AuthService : IAuthService
{
    private readonly IApplicationDbContext _db;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITokenService _tokenService;
    private readonly IDateTime _dateTime;
    private readonly RefreshTokenOptions _refreshOptions;
    private readonly IRegistrationPolicy _registration;

    public AuthService(
        IApplicationDbContext db,
        IPasswordHasher passwordHasher,
        ITokenService tokenService,
        IDateTime dateTime,
        IOptions<RefreshTokenOptions> refreshOptions,
        IRegistrationPolicy registration)
    {
        _registration = registration;
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

        return Result<AuthResponse>.Success(await IssueTokensAsync(user, deviceInfo: null, ct));
    }

    public async Task<Result<AuthResponse>> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user is null || !_passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            return Result<AuthResponse>.Failure("Invalid email or password.");
        }

        user.LastLoginAtUtc = _dateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Result<AuthResponse>.Success(await IssueTokensAsync(user, request.DeviceInfo, ct));
    }

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
