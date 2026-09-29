using AiPlanner.Application.Auth.DTOs;
using AiPlanner.Application.Common.Models;

namespace AiPlanner.Application.Auth.Interfaces;

public interface IAuthService
{
    Task<Result<AuthResponse>> RegisterAsync(RegisterRequest request, CancellationToken ct = default);
    Task<Result<AuthResponse>> LoginAsync(LoginRequest request, CancellationToken ct = default);
    Task<Result<AuthResponse>> RefreshAsync(string refreshToken, CancellationToken ct = default);
    Task<Result> RevokeRefreshTokenAsync(string refreshToken, CancellationToken ct = default);
}
