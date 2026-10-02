using AiPlanner.Application.Auth.DTOs;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Users.DTOs;
using AiPlanner.Application.Users.Interfaces;
using Microsoft.AspNetCore.Authorization;
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

    public UsersController(IApplicationDbContext db, ICurrentUserService currentUser, IUserProfileService profile)
    {
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

        return Ok(new UserDto(user.Id, user.Email, user.DisplayName, user.TimeZoneId, user.Locale, user.CreatedAtUtc));
    }

    /// <summary>PATCH /api/users/me - change profile settings (for now the language/locale).</summary>
    [HttpPatch("me")]
    public async Task<ActionResult<UserDto>> Update(UpdateProfileRequest request, CancellationToken ct)
    {
        var result = await _profile.UpdateAsync(request, ct);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { errors = result.Errors });
    }
}
