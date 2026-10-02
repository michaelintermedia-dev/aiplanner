namespace AiPlanner.Application.Auth.DTOs;
/// <param name="Locale">The device language (BCP 47); the app starts in it. Optional.</param>
public record RegisterRequest(string Email, string Password, string DisplayName, string? TimeZoneId, string? Locale = null);
