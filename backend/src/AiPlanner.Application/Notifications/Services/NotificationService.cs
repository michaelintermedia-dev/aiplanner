using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Models;
using AiPlanner.Application.Common.Utils;
using AiPlanner.Application.Notifications.DTOs;
using AiPlanner.Application.Notifications.Interfaces;
using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Entities;
using AiPlanner.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Notifications.Services;

/// <summary>
/// Phase 4. The backend decides what goes off when (spec section 23); clients
/// fetch the upcoming list and deliver it as local notifications. Reminder
/// occurrences are computed on the fly from the reminders themselves, so
/// editing an item or a reminder is reflected on the next sync.
/// </summary>
public class NotificationService : INotificationService
{
    public const int MaxHours = 14 * 24;
    public const int MaxItems = 200;

    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTime _clock;

    public NotificationService(IApplicationDbContext db, ICurrentUserService currentUser, IDateTime clock)
    {
        _db = db;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<IReadOnlyList<UpcomingNotificationDto>> GetUpcomingAsync(int hours, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var settings = await SettingsAsync(userId, track: false, ct);
        if (!settings.NotificationsEnabled)
        {
            return [];
        }

        var zone = UserTimeZoneHelper.ResolveTimeZone(await _db.Users.Where(u => u.Id == userId).Select(u => u.TimeZoneId).FirstAsync(ct));
        var from = _clock.UtcNow;
        var to = from.AddHours(Math.Clamp(hours, 1, MaxHours));
        var result = new List<UpcomingNotificationDto>();

        // ---- reminders ----
        var reminders = await _db.Reminders
            .AsNoTracking()
            .Include(r => r.TaskItem)
            .Include(r => r.Appointment)
            .Include(r => r.Note)
            .Where(r => r.UserId == userId && !r.IsCancelled
                        && (r.Kind == ReminderKind.Daily || r.Kind == ReminderKind.Weekdays || r.Kind == ReminderKind.Weekly
                            || (r.TriggerAtUtc >= from && r.TriggerAtUtc < to)))
            .ToListAsync(ct);

        foreach (var r in reminders)
        {
            var (itemType, itemId, title, itemTime, open) = r switch
            {
                { TaskItem: { } t } => ("Task", t.Id, t.Title, t.HasDueTime ? t.DueDateUtc : null,
                    t.Status is not (TaskItemStatus.Completed or TaskItemStatus.Cancelled)),
                { Appointment: { } a } => ("Appointment", a.Id, a.Title, (DateTime?)a.StartUtc, a.Status == AppointmentStatus.Scheduled),
                { Note: { } n } => ("Note", n.Id, n.Title ?? NotificationSchedule.Snippet(n.Content, 80), null, true),
                _ => (null, Guid.Empty, "", null, false), // owner deleted
            };
            if (itemType is null || !open
                || (itemType == "Task" && !settings.TaskRemindersEnabled)
                || (itemType == "Appointment" && !settings.AppointmentRemindersEnabled))
            {
                continue;
            }

            foreach (var at in NotificationSchedule.Occurrences(r, from, to, zone))
            {
                var body = itemType == "Note" && r.Note is { } note && note.Title is not null
                    ? NotificationSchedule.Snippet(note.Content)
                    : NotificationSchedule.ReminderBody(r, itemType, itemTime, at, zone);
                result.Add(new UpcomingNotificationDto(
                    $"r:{r.Id:N}:{at.Ticks}", "Reminder", at, title, body, itemType, itemId, CanComplete: itemType == "Task"));
            }
        }

        // ---- snoozes ----
        var snoozed = await _db.Notifications
            .AsNoTracking()
            .Where(n => n.UserId == userId && n.Status == NotificationStatus.Snoozed && n.ScheduledForUtc >= from && n.ScheduledForUtc < to)
            .ToListAsync(ct);
        result.AddRange(snoozed.Select(n => new UpcomingNotificationDto(
            $"s:{n.Id:N}",
            "Snoozed",
            n.ScheduledForUtc,
            n.Title,
            n.Body,
            n.TaskItemId is not null ? "Task" : n.AppointmentId is not null ? "Appointment" : n.NoteId is not null ? "Note" : null,
            n.TaskItemId ?? n.AppointmentId ?? n.NoteId,
            CanComplete: n.TaskItemId is not null)));

        // ---- daily summary ----
        if (settings.DailySummaryEnabled)
        {
            result.AddRange(await DailySummariesAsync(userId, TimeOnly.FromTimeSpan(settings.DailySummaryTime), from, to, zone, ct));
        }

        return result.OrderBy(n => n.AtUtc).ThenBy(n => n.Key, StringComparer.Ordinal).Take(MaxItems).ToList();
    }

    public async Task<Result<UpcomingNotificationDto>> SnoozeAsync(SnoozeRequest request, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var owned = request.ItemType switch
        {
            "Task" => await _db.TaskItems.AnyAsync(t => t.Id == request.ItemId && t.UserId == userId, ct),
            "Appointment" => await _db.Appointments.AnyAsync(a => a.Id == request.ItemId && a.UserId == userId, ct),
            _ => await _db.Notes.AnyAsync(n => n.Id == request.ItemId && n.UserId == userId, ct),
        };
        if (!owned)
        {
            return Result<UpcomingNotificationDto>.Failure("Item not found.");
        }

        var at = _clock.UtcNow.AddMinutes(request.Minutes);
        var notification = new Notification
        {
            UserId = userId,
            Type = request.ItemType switch
            {
                "Task" => NotificationType.TaskReminder,
                "Appointment" => NotificationType.AppointmentReminder,
                _ => NotificationType.NoteReminder,
            },
            Status = NotificationStatus.Snoozed,
            Title = request.Title.Trim(),
            Body = request.Body,
            ScheduledForUtc = at,
            SnoozedUntilUtc = at,
            TaskItemId = request.ItemType == "Task" ? request.ItemId : null,
            AppointmentId = request.ItemType == "Appointment" ? request.ItemId : null,
            NoteId = request.ItemType == "Note" ? request.ItemId : null,
        };
        _db.Notifications.Add(notification);
        await _db.SaveChangesAsync(ct);

        return Result<UpcomingNotificationDto>.Success(new UpcomingNotificationDto(
            $"s:{notification.Id:N}", "Snoozed", at, notification.Title, notification.Body,
            request.ItemType, request.ItemId, CanComplete: request.ItemType == "Task"));
    }

    public async Task<NotificationSettingsDto> GetSettingsAsync(CancellationToken ct = default) =>
        ToDto(await SettingsAsync(RequireUserId(), track: false, ct));

    public async Task<NotificationSettingsDto> UpdateSettingsAsync(NotificationSettingsDto dto, CancellationToken ct = default)
    {
        var settings = await SettingsAsync(RequireUserId(), track: true, ct);
        settings.NotificationsEnabled = dto.Enabled;
        settings.TaskRemindersEnabled = dto.TaskReminders;
        settings.AppointmentRemindersEnabled = dto.AppointmentReminders;
        settings.DailySummaryEnabled = dto.DailySummary;
        settings.DailySummaryTime = ReminderSchedule.ParseTime(dto.DailySummaryTime)!.Value.ToTimeSpan();
        settings.UpdatedAtUtc = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return ToDto(settings);
    }

    // ---- helpers ----

    private async Task<IEnumerable<UpcomingNotificationDto>> DailySummariesAsync(
        Guid userId, TimeOnly time, DateTime from, DateTime to, TimeZoneInfo zone, CancellationToken ct)
    {
        var tasks = await _db.TaskItems
            .AsNoTracking()
            .Where(t => t.UserId == userId && t.DueDateUtc != null && t.DueDateUtc < to.AddDays(1)
                        && t.Status != TaskItemStatus.Completed && t.Status != TaskItemStatus.Cancelled)
            .Select(t => new { t.DueDateUtc, t.Priority })
            .ToListAsync(ct);
        var events = await _db.Appointments
            .AsNoTracking()
            .Where(a => a.UserId == userId && a.Status == AppointmentStatus.Scheduled && a.StartUtc >= from.AddDays(-1) && a.StartUtc < to.AddDays(1))
            .Select(a => a.StartUtc)
            .ToListAsync(ct);

        var summaries = new List<UpcomingNotificationDto>();
        var day = UserTimeZoneHelper.TodayInTimeZone(zone, from);
        for (var i = 0; i < 15; i++, day = day.AddDays(1))
        {
            var at = UserTimeZoneHelper.LocalToUtc(day.ToDateTime(time), zone);
            if (at >= to)
            {
                break;
            }
            if (at < from)
            {
                continue;
            }
            var start = UserTimeZoneHelper.LocalDateStartToUtc(day, zone);
            var end = UserTimeZoneHelper.LocalDateEndToUtc(day, zone);
            var dueToday = tasks.Where(t => t.DueDateUtc >= start && t.DueDateUtc < end).ToList();
            var body = NotificationSchedule.DailySummary(
                dueToday.Count,
                dueToday.Count(t => t.Priority == TaskPriority.High),
                tasks.Count(t => t.DueDateUtc < start),
                events.Count(s => s >= start && s < end));
            if (body is not null)
            {
                summaries.Add(new UpcomingNotificationDto($"d:{day:yyyy-MM-dd}", "DailySummary", at, "Your day", body, null, null, false));
            }
        }
        return summaries;
    }

    private async Task<UserSettings> SettingsAsync(Guid userId, bool track, CancellationToken ct)
    {
        var query = _db.UserSettings.Where(s => s.UserId == userId);
        var settings = await (track ? query : query.AsNoTracking()).FirstOrDefaultAsync(ct);
        if (settings is null)
        {
            // Accounts created before settings existed get the defaults.
            settings = new UserSettings { UserId = userId };
            _db.UserSettings.Add(settings);
            await _db.SaveChangesAsync(ct);
        }
        return settings;
    }

    private static NotificationSettingsDto ToDto(UserSettings s) => new(
        s.NotificationsEnabled,
        s.TaskRemindersEnabled,
        s.AppointmentRemindersEnabled,
        s.DailySummaryEnabled,
        ReminderSchedule.FormatTime(TimeOnly.FromTimeSpan(s.DailySummaryTime)));

    private Guid RequireUserId() =>
        _currentUser.UserId ?? throw new UnauthorizedAccessException("No authenticated user.");
}
