using AiPlanner.Application.Appointments.DTOs;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Utils;
using AiPlanner.Application.Notifications.Interfaces;
using AiPlanner.Application.Tasks.DTOs;
using AiPlanner.Application.Today.DTOs;
using AiPlanner.Application.Today.Interfaces;
using AiPlanner.Domain.Entities;
using AiPlanner.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Today.Services;

public class TodayService : ITodayService
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTime _dateTime;
    private readonly INotificationService _notifications;

    public TodayService(IApplicationDbContext db, ICurrentUserService currentUser, IDateTime dateTime, INotificationService notifications)
    {
        _db = db;
        _currentUser = currentUser;
        _dateTime = dateTime;
        _notifications = notifications;
    }

    public async Task<TodayDto> GetTodayAsync(DateOnly? date, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("No authenticated user.");

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new KeyNotFoundException("User not found.");

        var timeZone = UserTimeZoneHelper.ResolveTimeZone(user.TimeZoneId);
        var utcNow = _dateTime.UtcNow;
        var targetDate = date ?? UserTimeZoneHelper.TodayInTimeZone(timeZone, utcNow);

        var dayStartUtc = UserTimeZoneHelper.LocalDateStartToUtc(targetDate, timeZone);
        var dayEndUtc = UserTimeZoneHelper.LocalDateEndToUtc(targetDate, timeZone);

        var appointmentsToday = await _db.Appointments
            .AsNoTracking()
            .Include(a => a.Participants)
            .Where(a => a.UserId == userId
                        && a.Status != AppointmentStatus.Cancelled
                        && a.StartUtc < dayEndUtc
                        && a.EndUtc >= dayStartUtc)
            .OrderBy(a => a.StartUtc)
            .ToListAsync(ct);

        var openTaskStatuses = new[] { TaskItemStatus.Inbox, TaskItemStatus.Planned, TaskItemStatus.InProgress };

        var tasksDueToday = await _db.TaskItems
            .AsNoTracking()
            .Include(t => t.TaskTags).ThenInclude(tt => tt.Tag)
            .Where(t => t.UserId == userId
                        && openTaskStatuses.Contains(t.Status)
                        && t.DueDateUtc != null
                        && t.DueDateUtc >= dayStartUtc
                        && t.DueDateUtc < dayEndUtc)
            .OrderBy(t => t.DueDateUtc)
            .ToListAsync(ct);

        var ongoingTasks = await _db.TaskItems
            .AsNoTracking()
            .Include(t => t.TaskTags).ThenInclude(tt => tt.Tag)
            .Where(t => t.UserId == userId && t.Status == TaskItemStatus.Ongoing)
            .OrderByDescending(t => t.Priority)
            .ToListAsync(ct);

        var overdueTasks = await _db.TaskItems
            .AsNoTracking()
            .Include(t => t.TaskTags).ThenInclude(tt => tt.Tag)
            .Where(t => t.UserId == userId
                        && openTaskStatuses.Contains(t.Status)
                        && t.DueDateUtc != null
                        && t.DueDateUtc < dayStartUtc)
            .OrderBy(t => t.DueDateUtc)
            .ToListAsync(ct);

        // "Upcoming" - the next 7 days of reminders (spec section 13), from the
        // same schedule notifications use, so repeating ones show too.
        var hours = (int)Math.Ceiling((dayEndUtc.AddDays(7) - utcNow).TotalHours);
        var upcoming = hours <= 0 ? [] : (await _notifications.GetUpcomingAsync(hours, ct))
            .Where(n => n.ItemType is not null && n.ItemId is not null)
            .Take(20)
            .Select(n => new UpcomingReminderDto(n.Key, n.AtUtc, n.Title, n.ItemType!, n.ItemId!.Value))
            .ToList();

        return new TodayDto(
            targetDate,
            appointmentsToday.Select(ToAppointmentDto).ToList(),
            tasksDueToday.Select(ToTaskDto).ToList(),
            ongoingTasks.Select(ToTaskDto).ToList(),
            overdueTasks.Select(ToTaskDto).ToList(),
            upcoming);
    }

    private static TaskItemDto ToTaskDto(TaskItem t) => new(
        t.Id, t.Title, t.Description, t.Notes, t.AiSummary,
        t.StartDateUtc, t.DueDateUtc, t.HasDueTime, t.Status, t.Priority, t.CompletedAtUtc,
        t.TaskTags.Select(tt => tt.Tag.Name).OrderBy(n => n).ToList(),
        t.CreatedAtUtc, t.UpdatedAtUtc);

    private static AppointmentDto ToAppointmentDto(Appointment a) => new(
        a.Id, a.Title, a.Description, a.Notes, a.AiSummary,
        a.StartUtc, a.EndUtc, a.Location, a.Status,
        a.Participants.Select(p => new AppointmentParticipantDto(p.Name, p.Email)).ToList(),
        a.CreatedAtUtc, a.UpdatedAtUtc);
}
