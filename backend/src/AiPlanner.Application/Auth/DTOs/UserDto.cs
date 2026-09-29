namespace AiPlanner.Application.Auth.DTOs;
public record UserDto(Guid Id, string Email, string DisplayName, string TimeZoneId, string Locale, DateTime CreatedAtUtc);
