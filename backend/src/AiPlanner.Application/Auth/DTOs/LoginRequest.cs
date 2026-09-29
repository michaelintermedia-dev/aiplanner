namespace AiPlanner.Application.Auth.DTOs;
public record LoginRequest(string Email, string Password, string? DeviceInfo);
