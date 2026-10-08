using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Models;
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
    private readonly IFileStorageService _storage;

    /// <summary>A wallpaper photo (shrunk on the device first, so this is generous).</summary>
    public const long MaxPhotoBytes = 15L * 1024 * 1024;
    private static readonly string[] PhotoExtensions = [".jpg", ".jpeg", ".png", ".webp"];

    public AppearanceSettingsService(IApplicationDbContext db, ICurrentUserService currentUser, IDateTime clock, IFileStorageService storage)
    {
        _db = db;
        _currentUser = currentUser;
        _clock = clock;
        _storage = storage;
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
        var settings = await TrackedAsync(userId, ct);
        settings.Theme = dto.Theme;
        settings.Skin = dto.Skin;
        settings.Wallpaper = dto.Wallpaper;
        settings.UpdatedAtUtc = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return ToDto(settings);
    }

    /// <summary>
    /// The user's own wallpaper: stores the photo (replacing an earlier one) and
    /// turns the wallpaper on. Only the extension decides the type; never shown
    /// to anyone else.
    /// </summary>
    public async Task<Result<AppearanceSettingsDto>> SetPhotoAsync(string fileName, long sizeBytes, Stream content, CancellationToken ct = default)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        if (!PhotoExtensions.Contains(extension))
            return Result<AppearanceSettingsDto>.Failure("Use a JPG, PNG or WebP picture.");
        if (sizeBytes <= 0 || sizeBytes > MaxPhotoBytes)
            return Result<AppearanceSettingsDto>.Failure($"The picture must be under {MaxPhotoBytes / (1024 * 1024)} MB.");

        var userId = RequireUserId();
        var settings = await TrackedAsync(userId, ct);
        var old = settings.WallpaperPhotoKey;
        // A new key every time (storage never overwrites), which also tells
        // devices that cached the old picture to fetch the new one.
        settings.WallpaperPhotoKey = $"{userId:N}/wallpaper/{Guid.NewGuid():N}{(extension == ".jpeg" ? ".jpg" : extension)}";
        await _storage.SaveAsync(settings.WallpaperPhotoKey, content, ct);
        settings.Wallpaper = true;
        settings.UpdatedAtUtc = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        if (old is not null) await _storage.DeleteAsync(old, ct);
        return Result<AppearanceSettingsDto>.Success(ToDto(settings));
    }

    /// <summary>Back to the skin's wallpaper: the photo is deleted.</summary>
    public async Task<AppearanceSettingsDto> RemovePhotoAsync(CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var settings = await TrackedAsync(userId, ct);
        if (settings.WallpaperPhotoKey is { } key)
        {
            settings.WallpaperPhotoKey = null;
            settings.UpdatedAtUtc = _clock.UtcNow;
            await _db.SaveChangesAsync(ct);
            await _storage.DeleteAsync(key, ct);
        }
        return ToDto(settings);
    }

    /// <summary>The photo, if <paramref name="id"/> is the current one (the id is what devices cache it by).</summary>
    public async Task<(Stream Content, string ContentType)?> OpenPhotoAsync(string id, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var key = await _db.UserSettings.Where(s => s.UserId == userId).Select(s => s.WallpaperPhotoKey).FirstOrDefaultAsync(ct);
        if (key is null || PhotoId(key) != id) return null;
        var stream = await _storage.OpenReadAsync(key, ct);
        var type = Path.GetExtension(key) switch { ".png" => "image/png", ".webp" => "image/webp", _ => "image/jpeg" };
        return stream is null ? null : (stream, type);
    }

    private async Task<UserSettings> TrackedAsync(Guid userId, CancellationToken ct)
    {
        var settings = await _db.UserSettings.FirstOrDefaultAsync(s => s.UserId == userId, ct);
        if (settings is null)
        {
            // Accounts created before settings existed get the defaults.
            settings = new UserSettings { UserId = userId };
            _db.UserSettings.Add(settings);
        }
        return settings;
    }

    /// <summary>The photo's public id: the file name part of its key (no folders - the key stays on the server).</summary>
    private static string PhotoId(string key) => Path.GetFileNameWithoutExtension(key);

    /// <summary>Unknown stored values (from an older version) read as the defaults.</summary>
    private static AppearanceSettingsDto ToDto(UserSettings s) => new(
        AppearanceSettingsDto.Themes.Contains(s.Theme) ? s.Theme : "System",
        AppearanceSettingsDto.Skins.Contains(s.Skin) ? s.Skin : "Indigo",
        s.Wallpaper,
        s.WallpaperPhotoKey is { } key ? PhotoId(key) : null);

    private Guid RequireUserId() =>
        _currentUser.UserId ?? throw new UnauthorizedAccessException("No authenticated user.");
}
