using Microsoft.AspNetCore.RateLimiting;
using AiPlanner.Application.Auth.DTOs;
using AiPlanner.Application.Auth.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiPlanner.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request, CancellationToken ct)
    {
        var result = await _authService.RegisterAsync(request, ct);
        if (!result.Succeeded) return Conflict(new { errors = result.Errors });
        return Ok(result.Value);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken ct)
    {
        var result = await _authService.LoginAsync(request, ct);
        if (!result.Succeeded) return Unauthorized(new { errors = result.Errors });
        return Ok(result.Value);
    }

    /// <summary>POST /api/auth/external - sign in or up with a Google/Apple ID token.</summary>
    [HttpPost("external")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponse>> External(ExternalLoginRequest request, CancellationToken ct)
    {
        var result = await _authService.ExternalLoginAsync(request, ct);
        if (!result.Succeeded) return Unauthorized(new { errors = result.Errors });
        return Ok(result.Value);
    }

    /// <summary>GET /api/auth/providers - which "Sign in with ..." buttons to show (public ids only).</summary>
    [HttpGet("providers")]
    [AllowAnonymous]
    public ActionResult<ExternalProvidersDto> Providers() => Ok(_authService.ExternalProviders);

    /// <summary>POST /api/auth/password - change it (or set one on a Google/Apple-only account); other sessions end, this one gets new tokens.</summary>
    [HttpPost("password")]
    [Authorize]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponse>> ChangePassword(ChangePasswordRequest request, CancellationToken ct)
    {
        if (CurrentUserId is not { } id) return Unauthorized();
        var result = await _authService.ChangePasswordAsync(id, request, ct);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { errors = result.Errors });
    }

    /// <summary>POST /api/auth/sign-out-everywhere - every session ends, this one too.</summary>
    [HttpPost("sign-out-everywhere")]
    [Authorize]
    public async Task<IActionResult> SignOutEverywhere(CancellationToken ct)
    {
        if (CurrentUserId is not { } id) return Unauthorized();
        await _authService.SignOutEverywhereAsync(id, ct);
        return NoContent();
    }

    /// <summary>POST /api/auth/email/send - a new confirmation code to the account's email.</summary>
    [HttpPost("email/send")]
    [Authorize]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> SendVerification(CancellationToken ct)
    {
        if (CurrentUserId is not { } id) return Unauthorized();
        var result = await _authService.SendVerificationAsync(id, ct);
        return result.Succeeded ? NoContent() : BadRequest(new { errors = result.Errors });
    }

    /// <summary>POST /api/auth/email/verify - { code }.</summary>
    [HttpPost("email/verify")]
    [Authorize]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> VerifyEmail(VerifyEmailRequest request, CancellationToken ct)
    {
        if (CurrentUserId is not { } id) return Unauthorized();
        var result = await _authService.VerifyEmailAsync(id, request.Code, ct);
        return result.Succeeded ? NoContent() : BadRequest(new { errors = result.Errors });
    }

    /// <summary>POST /api/auth/password/forgot - { email }; always 204 (never tells whether the account exists).</summary>
    [HttpPost("password/forgot")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request, CancellationToken ct)
    {
        await _authService.ForgotPasswordAsync(request.Email, ct);
        return NoContent();
    }

    /// <summary>POST /api/auth/password/reset - { email, code, newPassword }; signs in.</summary>
    [HttpPost("password/reset")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponse>> ResetPassword(ResetPasswordRequest request, CancellationToken ct)
    {
        var result = await _authService.ResetPasswordAsync(request, ct);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { errors = result.Errors });
    }

    private Guid? CurrentUserId => Guid.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value, out var id) ? id : null;

    [HttpPost("refresh")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponse>> Refresh(RefreshTokenRequest request, CancellationToken ct)
    {
        var result = await _authService.RefreshAsync(request.RefreshToken, ct);
        if (!result.Succeeded) return Unauthorized(new { errors = result.Errors });
        return Ok(result.Value);
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout(RefreshTokenRequest request, CancellationToken ct)
    {
        await _authService.RevokeRefreshTokenAsync(request.RefreshToken, ct);
        return NoContent();
    }
}
