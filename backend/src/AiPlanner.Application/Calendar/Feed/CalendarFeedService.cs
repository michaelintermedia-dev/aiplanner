using System.Security.Cryptography;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Utils;
using AiPlanner.Application.Recurrence;
using AiPlanner.Domain.Entities;
using AiPlanner.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Calendar.Feed;

/// <summary>
/// Settings - Calendar - "Show in your phone's calendar" (2026-10-23): a private
/// link (a long random token, like a password) that calendar apps subscribe to.
/// A new link replaces the old one; turning it off removes it.
/// </summary>
public class CalendarFeedService
{
    /// <summary>How far back past events and tasks are kept in the feed.</summary>
    private const int PastDays = 60;
    private const int MaxEach = 3000;

    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTime _clock;

    public CalendarFeedService(IApplicationDbContext db, ICurrentUserService currentUser, IDateTime clock)
    {
        _db = db;
        _currentUser = currentUser;
        _clock = clock;
    }

    private Guid UserId => _currentUser.UserId ?? throw new UnauthorizedAccessException("No authenticated user.");

    /// <summary>The current link's token (null: off).</summary>
    public async Task<string?> GetTokenAsync(CancellationToken ct = default) =>
        await _db.UserSettings.Where(s => s.UserId == UserId).Select(s => s.CalendarFeedToken).FirstOrDefaultAsync(ct);

    /// <summary>A new link (the old one stops working).</summary>
    public async Task<string> NewTokenAsync(CancellationToken ct = default)
    {
        var settings = await SettingsAsync(ct);
        settings.CalendarFeedToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(24)).Replace('+', '-').Replace('/', '_').TrimEnd('=');
        settings.UpdatedAtUtc = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return settings.CalendarFeedToken;
    }

    public async Task TurnOffAsync(CancellationToken ct = default)
    {
        var settings = await SettingsAsync(ct);
        settings.CalendarFeedToken = null;
        settings.UpdatedAtUtc = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    /// <summary>The feed for a link (null: no such link). No sign-in - the token is the key.</summary>
    public async Task<string?> BuildAsync(string token, string appUrl, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 64) return null;
        var owner = await _db.UserSettings.Where(s => s.CalendarFeedToken == token)
            .Select(s => new { s.UserId, s.User.TimeZoneId }).FirstOrDefaultAsync(ct);
        if (owner is null) return null;

        var zone = UserTimeZoneHelper.ResolveTimeZone(owner.TimeZoneId);
        var zoneId = string.IsNullOrWhiteSpace(owner.TimeZoneId) ? "UTC" : owner.TimeZoneId;
        var now = _clock.UtcNow;
        var since = now.AddDays(-PastDays);

        var events = await _db.Appointments.AsNoTracking().Include(a => a.RecurrenceRule)
            .Where(a => a.UserId == owner.UserId && a.Status != AppointmentStatus.Cancelled && (a.RecurrenceRuleId != null || a.EndUtc >= since))
            .OrderBy(a => a.StartUtc).Take(MaxEach).ToListAsync(ct);
        var tasks = await _db.TaskItems.AsNoTracking()
            .Where(t => t.UserId == owner.UserId && t.DueDateUtc != null && t.DueDateUtc >= since
                && t.Status != TaskItemStatus.Completed && t.Status != TaskItemStatus.Cancelled)
            .OrderBy(t => t.DueDateUtc).Take(MaxEach).ToListAsync(ct);

        var entries = events.Select(a => new IcsEntry(a.Id, a.Title, a.Description, a.Location, a.StartUtc, a.EndUtc, false,
                RecurrencePlanner.ToDto(a.RecurrenceRule), a.SkippedOccurrencesUtc, a.UpdatedAtUtc, $"{appUrl}/appointments/{a.Id}"))
            .Concat(tasks.Select(t => new IcsEntry(t.Id, t.Title, t.Description, t.Location, t.DueDateUtc!.Value,
                t.DueDateUtc.Value.AddMinutes(30), !t.HasDueTime, null, [], t.UpdatedAtUtc, $"{appUrl}/tasks/{t.Id}")));
        return IcsCalendar.Build(entries, "Gatazee", zone, zoneId, now);
    }

    private async Task<UserSettings> SettingsAsync(CancellationToken ct)
    {
        var settings = await _db.UserSettings.FirstOrDefaultAsync(s => s.UserId == UserId, ct);
        if (settings is null)
        {
            settings = new UserSettings { UserId = UserId };
            _db.UserSettings.Add(settings);
        }
        return settings;
    }
}
