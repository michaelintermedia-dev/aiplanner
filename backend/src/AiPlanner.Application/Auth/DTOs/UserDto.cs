namespace AiPlanner.Application.Auth.DTOs;
public record UserDto(Guid Id, string Email, string DisplayName, string TimeZoneId, string Locale, DateTime CreatedAtUtc, bool IsAdmin = false); // IsAdmin: may open the operator pages (only set by GET /users/me)
