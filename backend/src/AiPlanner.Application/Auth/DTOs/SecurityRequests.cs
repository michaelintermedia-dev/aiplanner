namespace AiPlanner.Application.Auth.DTOs;

/// <summary>Change the password - or set one on a Google/Apple-only account (no current password then).</summary>
public record ChangePasswordRequest(string? CurrentPassword, string NewPassword, string? DeviceInfo = null);

/// <summary>The 6-digit code from the confirmation email.</summary>
public record VerifyEmailRequest(string Code);

/// <summary>"Forgot password?": send a reset code to this address (if it has an account).</summary>
public record ForgotPasswordRequest(string Email);

/// <summary>Reset with the emailed code; signs in.</summary>
public record ResetPasswordRequest(string Email, string Code, string NewPassword, string? DeviceInfo = null);
