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
