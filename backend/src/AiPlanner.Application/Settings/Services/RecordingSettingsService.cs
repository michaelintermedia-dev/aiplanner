using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Settings.DTOs;
using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Settings.Services;

/// <summary>Settings - Recordings (GET/PUT /api/settings/recordings).</summary>
public class RecordingSettingsService
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTime _clock;

    public RecordingSettingsService(IApplicationDbContext db, ICurrentUserService currentUser, IDateTime clock)
    {
        _db = db;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<RecordingSettingsDto> GetAsync(CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var settings = await _db.UserSettings.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == userId, ct);
        return ToDto(settings ?? new UserSettings());
    }

    public async Task<RecordingSettingsDto> UpdateAsync(RecordingSettingsDto dto, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var settings = await _db.UserSettings.FirstOrDefaultAsync(s => s.UserId == userId, ct);
        if (settings is null)
        {
            // Accounts created before settings existed get the defaults.
            settings = new UserSettings { UserId = userId };
            _db.UserSettings.Add(settings);
        }
        settings.KeepRecordings = dto.KeepRecordings;
        settings.OneEntryPerMessage = dto.OneEntryPerMessage;
        settings.UpdatedAtUtc = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return ToDto(settings);
    }

    private static RecordingSettingsDto ToDto(UserSettings s) =>
        new(s.KeepRecordings, s.OneEntryPerMessage);

    private Guid RequireUserId() =>
        _currentUser.UserId ?? throw new UnauthorizedAccessException("No authenticated user.");
}
