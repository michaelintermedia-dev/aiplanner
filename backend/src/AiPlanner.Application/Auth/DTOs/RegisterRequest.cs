namespace AiPlanner.Application.Auth.DTOs;
public record RegisterRequest(string Email, string Password, string DisplayName, string? TimeZoneId);
