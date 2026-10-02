namespace AiPlanner.Application.Users.DTOs;

/// <summary>PATCH /api/users/me: the fields to change (null = keep).</summary>
/// <param name="Locale">BCP 47, e.g. "ru-RU" - the app's language and date formats.</param>
public record UpdateProfileRequest(string? Locale);
