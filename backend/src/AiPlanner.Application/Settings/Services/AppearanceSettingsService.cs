using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Settings.DTOs;
using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Settings.Services;

/// <summary>Settings - Appearance (GET/PUT /api/settings/appearance).</summary>
public class AppearanceSettingsService
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTime _clock;

    public AppearanceSettingsService(IApplicationDbContext db, ICurrentUserService currentUser, IDateTime clock)
    {
        _db = db;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<AppearanceSettingsDto> GetAsync(CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var settings = await _db.UserSettings.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == userId, ct);
        return ToDto(settings ?? new UserSettings());
    }

    public async Task<AppearanceSettingsDto> UpdateAsync(AppearanceSettingsDto dto, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var settings = await _db.UserSettings.FirstOrDefaultAsync(s => s.UserId == userId, ct);
        if (settings is null)
        {
            // Accounts created before settings existed get the defaults.
            settings = new UserSettings { UserId = userId };
            _db.UserSettings.Add(settings);
        }
        settings.Theme = dto.Theme;
        settings.Skin = dto.Skin;
        settings.Wallpaper = dto.Wallpaper;
        settings.UpdatedAtUtc = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return ToDto(settings);
    }

    /// <summary>Unknown stored values (from an older version) read as the defaults.</summary>
    private static AppearanceSettingsDto ToDto(UserSettings s) => new(
        AppearanceSettingsDto.Themes.Contains(s.Theme) ? s.Theme : "System",
        AppearanceSettingsDto.Skins.Contains(s.Skin) ? s.Skin : "Indigo",
        s.Wallpaper);

    private Guid RequireUserId() =>
        _currentUser.UserId ?? throw new UnauthorizedAccessException("No authenticated user.");
}
