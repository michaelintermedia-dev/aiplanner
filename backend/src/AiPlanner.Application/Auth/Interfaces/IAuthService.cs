using AiPlanner.Application.Auth.DTOs;
using AiPlanner.Application.Common.Models;

namespace AiPlanner.Application.Auth.Interfaces;

public interface IAuthService
{
    Task<Result<AuthResponse>> RegisterAsync(RegisterRequest request, CancellationToken ct = default);
    Task<Result<AuthResponse>> LoginAsync(LoginRequest request, CancellationToken ct = default);
    /// <summary>Sign in or up with Google/Apple (POST /api/auth/external).</summary>
    Task<Result<AuthResponse>> ExternalLoginAsync(ExternalLoginRequest request, CancellationToken ct = default);
    /// <summary>Which provider buttons to show (GET /api/auth/providers).</summary>
    ExternalProvidersDto ExternalProviders { get; }
    Task<Result<AuthResponse>> ChangePasswordAsync(Guid userId, ChangePasswordRequest request, CancellationToken ct = default);
    Task SignOutEverywhereAsync(Guid userId, CancellationToken ct = default);
    Task<Result> SendVerificationAsync(Guid userId, CancellationToken ct = default);
    Task<Result> VerifyEmailAsync(Guid userId, string code, CancellationToken ct = default);
    Task ForgotPasswordAsync(string email, CancellationToken ct = default);
    Task<Result<AuthResponse>> ResetPasswordAsync(ResetPasswordRequest request, CancellationToken ct = default);
    /// <summary>The server can send email (codes to confirm an address, reset a password).</summary>
    bool EmailEnabled { get; }
    Task<Result<AuthResponse>> RefreshAsync(string refreshToken, CancellationToken ct = default);
    Task<Result> RevokeRefreshTokenAsync(string refreshToken, CancellationToken ct = default);
}
