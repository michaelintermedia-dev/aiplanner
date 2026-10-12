using AiPlanner.Application.Auth.DTOs;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Users.DTOs;
using AiPlanner.Application.Users.Interfaces;
using AiPlanner.Application.Users.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IUserProfileService _profile;
    private readonly IAdminPolicy _admins;
    private readonly AccountService _account;

    public UsersController(IApplicationDbContext db, ICurrentUserService currentUser, IUserProfileService profile, IAdminPolicy admins, AccountService account)
    {
        _account = account;
        _admins = admins;
        _db = db;
        _currentUser = currentUser;
        _profile = profile;
    }

    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> Me(CancellationToken ct)
    {
        if (_currentUser.UserId is not { } userId) return Unauthorized();

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return NotFound();

        return Ok(new UserDto(user.Id, user.Email, user.DisplayName, user.TimeZoneId, user.Locale, user.CreatedAtUtc, _admins.IsAdmin(user.Email)));
    }

    /// <summary>
    /// GET /api/users/me/export - everything in the account as a ZIP (data.json +
    /// photos, documents, recordings). Built in a temp file, then sent.
    /// </summary>
    [HttpGet("me/export")]
    public async Task<IActionResult> Export(CancellationToken ct)
    {
        var temp = new FileStream(Path.GetTempFileName(), FileMode.Create, FileAccess.ReadWrite, FileShare.None, 81920, FileOptions.DeleteOnClose | FileOptions.Asynchronous);
        var result = await _account.ExportAsync(temp, ct);
        if (!result.Succeeded)
        {
            await temp.DisposeAsync();
            return Unauthorized(new { errors = result.Errors });
        }
        temp.Position = 0;
        return File(temp, "application/zip", $"ai-planner-{DateTime.UtcNow:yyyy-MM-dd}.zip"); // disposed (and deleted) after sending
    }

    /// <summary>DELETE /api/users/me - deletes the account and everything in it, for good. Body: { confirmEmail }.</summary>
    [HttpDelete("me")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Delete(DeleteAccountRequest request, CancellationToken ct)
    {
        var result = await _account.DeleteAsync(request.ConfirmEmail, ct);
        return result.Succeeded ? NoContent() : BadRequest(new { errors = result.Errors });
    }

    /// <summary>PATCH /api/users/me - change profile settings (for now the language/locale).</summary>
    [HttpPatch("me")]
    public async Task<ActionResult<UserDto>> Update(UpdateProfileRequest request, CancellationToken ct)
    {
        var result = await _profile.UpdateAsync(request, ct);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { errors = result.Errors });
    }
}
