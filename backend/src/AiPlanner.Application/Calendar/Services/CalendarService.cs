using AiPlanner.Application.Calendar.DTOs;
using AiPlanner.Application.Calendar.Interfaces;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Utils;
using AiPlanner.Application.Tasks.DTOs;
using AiPlanner.Domain.Entities;
using AiPlanner.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Calendar.Services;

public class CalendarService : ICalendarService
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTime _dateTime;

    public CalendarService(IApplicationDbContext db, ICurrentUserService currentUser, IDateTime dateTime)
    {
        _db = db;
        _currentUser = currentUser;
        _dateTime = dateTime;
    }

    public async Task<CalendarRangeDto> GetRangeAsync(CalendarQueryParameters query, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("No authenticated user.");

        var (fromUtc, toUtc) = await ResolveRangeAsync(userId, query, ct);

        var appointments = await _db.Appointments
            .AsNoTracking()
            .Where(a => a.UserId == userId
                        && a.Status != AppointmentStatus.Cancelled
                        && a.StartUtc < toUtc
                        && a.EndUtc >= fromUtc)
            .ToListAsync(ct);

        var tasksInRange = await _db.TaskItems
            .AsNoTracking()
            .Where(t => t.UserId == userId
                        && t.Status != TaskItemStatus.Cancelled
                        && t.DueDateUtc != null
                        && t.DueDateUtc >= fromUtc
                        && t.DueDateUtc < toUtc)
            .ToListAsync(ct);

        var ongoingTasks = await _db.TaskItems
            .AsNoTracking()
            .Include(t => t.TaskTags).ThenInclude(tt => tt.Tag)
            .Where(t => t.UserId == userId && t.Status == TaskItemStatus.Ongoing)
            .ToListAsync(ct);

        var items = new List<CalendarItemDto>();

        items.AddRange(appointments.Select(a => new CalendarItemDto(
            a.Id, "Appointment", a.Title, a.StartUtc, a.EndUtc, true, a.Status.ToString(), null, a.Location)));

        items.AddRange(tasksInRange.Select(t => new CalendarItemDto(
            t.Id, "Task", t.Title, t.DueDateUtc!.Value, null, t.HasDueTime, t.Status.ToString(), t.Priority.ToString(), null)));

        return new CalendarRangeDto(
            fromUtc,
            toUtc,
            items.OrderBy(i => i.StartUtc).ToList(),
            ongoingTasks.Select(ToTaskDto).ToList());
    }

    private async Task<(DateTime FromUtc, DateTime ToUtc)> ResolveRangeAsync(Guid userId, CalendarQueryParameters query, CancellationToken ct)
    {
        if (query.FromUtc.HasValue && query.ToUtc.HasValue)
        {
            return (query.FromUtc.Value, query.ToUtc.Value);
        }

        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new KeyNotFoundException("User not found.");

        var timeZone = UserTimeZoneHelper.ResolveTimeZone(user.TimeZoneId);
        var anchor = query.AnchorDate ?? UserTimeZoneHelper.TodayInTimeZone(timeZone, _dateTime.UtcNow);
        var view = query.View ?? CalendarView.Month;

        return view switch
        {
            CalendarView.Day => (
                UserTimeZoneHelper.LocalDateStartToUtc(anchor, timeZone),
                UserTimeZoneHelper.LocalDateEndToUtc(anchor, timeZone)),

            CalendarView.Week => WeekRange(anchor, timeZone),

            CalendarView.Month => MonthRange(anchor, timeZone),

            _ => MonthRange(anchor, timeZone)
        };
    }

    private static (DateTime FromUtc, DateTime ToUtc) WeekRange(DateOnly anchor, TimeZoneInfo timeZone)
    {
        // ISO week: Monday..Sunday.
        var diffToMonday = ((int)anchor.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        var weekStart = anchor.AddDays(-diffToMonday);
        var weekEnd = weekStart.AddDays(7);

        return (
            UserTimeZoneHelper.LocalDateStartToUtc(weekStart, timeZone),
            UserTimeZoneHelper.LocalDateStartToUtc(weekEnd, timeZone));
    }

    private static (DateTime FromUtc, DateTime ToUtc) MonthRange(DateOnly anchor, TimeZoneInfo timeZone)
    {
        var monthStart = new DateOnly(anchor.Year, anchor.Month, 1);
        var monthEnd = monthStart.AddMonths(1);

        return (
            UserTimeZoneHelper.LocalDateStartToUtc(monthStart, timeZone),
            UserTimeZoneHelper.LocalDateStartToUtc(monthEnd, timeZone));
    }

    private static TaskItemDto ToTaskDto(TaskItem t) => new(
        t.Id, t.Title, t.Description, t.Notes, t.AiSummary,
        t.StartDateUtc, t.DueDateUtc, t.HasDueTime, t.Status, t.Priority, t.CompletedAtUtc,
        t.TaskTags.Select(tt => tt.Tag.Name).OrderBy(n => n).ToList(),
        t.CreatedAtUtc, t.UpdatedAtUtc);
}
