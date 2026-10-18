using AiPlanner.Application.Auth.DTOs;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Models;
using AiPlanner.Application.Common.Utils;
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
        if (request.TimeZoneId is not null && request.TimeZoneId != user.TimeZoneId)
        {
            await MoveAllDayTasksAsync(userId, UserTimeZoneHelper.ResolveTimeZone(user.TimeZoneId), UserTimeZoneHelper.ResolveTimeZone(request.TimeZoneId), ct);
            user.TimeZoneId = request.TimeZoneId;
        }
        user.UpdatedAtUtc = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Result<UserDto>.Success(new UserDto(user.Id, user.Email, user.DisplayName, user.TimeZoneId, user.Locale, user.CreatedAtUtc, false, user.EmailConfirmed, !string.IsNullOrEmpty(user.PasswordHash)));
    }

    /// <summary>
    /// A new time zone: tasks with a date but no time stay on the same calendar
    /// day (they're midnight in the user's zone), and their "before" reminders
    /// move with them. Times stay real moments - nothing else changes.
    /// </summary>
    private async Task MoveAllDayTasksAsync(Guid userId, TimeZoneInfo from, TimeZoneInfo to, CancellationToken ct)
    {
        var tasks = await _db.TaskItems.Where(t => t.UserId == userId && !t.HasDueTime && t.DueDateUtc != null).ToListAsync(ct);
        var moved = new Dictionary<Guid, TimeSpan>();
        foreach (var task in tasks)
        {
            var due = TimeZoneMove.AllDay(task.DueDateUtc!.Value, from, to);
            if (due == task.DueDateUtc) continue;
            moved[task.Id] = due - task.DueDateUtc.Value;
            task.DueDateUtc = due;
        }
        if (moved.Count == 0) return;
        var ids = moved.Keys.ToList();
        var reminders = await _db.Reminders
            .Where(r => r.UserId == userId && r.TaskItemId != null && ids.Contains(r.TaskItemId.Value) && r.Kind == Domain.Enums.ReminderKind.Before)
            .ToListAsync(ct);
        foreach (var r in reminders) r.TriggerAtUtc += moved[r.TaskItemId!.Value];
    }
}
