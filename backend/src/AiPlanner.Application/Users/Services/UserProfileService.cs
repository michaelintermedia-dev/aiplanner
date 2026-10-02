using AiPlanner.Application.Auth.DTOs;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Models;
using AiPlanner.Application.Users.DTOs;
using AiPlanner.Application.Users.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Users.Services;

public class UserProfileService : IUserProfileService
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTime _clock;

    public UserProfileService(IApplicationDbContext db, ICurrentUserService currentUser, IDateTime clock)
    {
        _db = db;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<Result<UserDto>> UpdateAsync(UpdateProfileRequest request, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("No authenticated user.");
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            return Result<UserDto>.Failure("User not found.");
        }

        if (request.Locale is not null)
        {
            user.Locale = request.Locale;
        }
        user.UpdatedAtUtc = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Result<UserDto>.Success(new UserDto(user.Id, user.Email, user.DisplayName, user.TimeZoneId, user.Locale, user.CreatedAtUtc));
    }
}
