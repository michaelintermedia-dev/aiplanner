using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Settings.DTOs;
using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Settings.Services;

/// <summary>Settings - Calendar (GET/PUT /api/settings/calendar).</summary>
public class CalendarSettingsService
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTime _clock;

    public CalendarSettingsService(IApplicationDbContext db, ICurrentUserService currentUser, IDateTime clock)
    {
        _db = db;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<CalendarSettingsDto> GetAsync(CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var stored = await _db.UserSettings.Where(s => s.UserId == userId).Select(s => s.FirstDayOfWeek).FirstOrDefaultAsync(ct);
        return new CalendarSettingsDto(CalendarSettingsDto.ToDay(stored).ToString());
    }

    public async Task<CalendarSettingsDto> UpdateAsync(CalendarSettingsDto dto, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var settings = await _db.UserSettings.FirstOrDefaultAsync(s => s.UserId == userId, ct);
        if (settings is null)
        {
            // Accounts created before settings existed get the defaults.
            settings = new UserSettings { UserId = userId };
            _db.UserSettings.Add(settings);
        }
        settings.FirstDayOfWeek = dto.FirstDayOfWeek;
        settings.UpdatedAtUtc = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return new CalendarSettingsDto(settings.FirstDayOfWeek);
    }

    private Guid RequireUserId() =>
        _currentUser.UserId ?? throw new UnauthorizedAccessException("No authenticated user.");
}
