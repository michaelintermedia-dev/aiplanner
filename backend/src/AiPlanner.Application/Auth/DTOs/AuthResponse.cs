namespace AiPlanner.Application.Auth.DTOs;
public record AuthResponse(Guid UserId, string Email, string DisplayName, string AccessToken, DateTime AccessTokenExpiresAtUtc, string RefreshToken);
