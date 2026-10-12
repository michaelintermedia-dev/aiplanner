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
    Task<Result<AuthResponse>> RefreshAsync(string refreshToken, CancellationToken ct = default);
    Task<Result> RevokeRefreshTokenAsync(string refreshToken, CancellationToken ct = default);
}
