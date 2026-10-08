using AiPlanner.Application.Recurrence;
using AiPlanner.Application.Calendar.DTOs;
using AiPlanner.Application.Calendar.Interfaces;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Settings.DTOs;
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
        var zone = UserTimeZoneHelper.ResolveTimeZone(
            await _db.Users.Where(u => u.Id == userId).Select(u => u.TimeZoneId).FirstOrDefaultAsync(ct));

        // Repeating events can fall in the range even when their first date is long before it.
        var appointments = await _db.Appointments
            .AsNoTracking()
            .Include(a => a.RecurrenceRule)
            .Where(a => a.UserId == userId
                        && a.Status != AppointmentStatus.Cancelled
                        && a.StartUtc < toUtc
                        && (a.EndUtc >= fromUtc || a.RecurrenceRuleId != null))
            .ToListAsync(ct);

        var tasksInRange = await _db.TaskItems
            .AsNoTracking()
            .Include(t => t.RecurrenceRule)
            .Where(t => t.UserId == userId
                        && t.Status != TaskItemStatus.Cancelled
                        && t.DueDateUtc != null
                        && t.DueDateUtc < toUtc
                        && (t.DueDateUtc >= fromUtc || (t.RecurrenceRuleId != null && t.Status != TaskItemStatus.Completed)))
            .ToListAsync(ct);

        var ongoingTasks = await _db.TaskItems
            .AsNoTracking()
            .Include(t => t.TaskTags).ThenInclude(tt => tt.Tag)
            .Where(t => t.UserId == userId && t.Status == TaskItemStatus.Ongoing)
            .ToListAsync(ct);

        var items = new List<CalendarItemDto>();

        foreach (var a in appointments)
        {
            var repeats = a.RecurrenceRule is not null;
            items.AddRange(EventOccurrences.In(a, zone, fromUtc, toUtc).Select(o => new CalendarItemDto(
                a.Id, "Appointment", a.Title, o.Start, o.End, true, a.Status.ToString(), null, a.Location, repeats)));
        }

        foreach (var t in tasksInRange)
        {
            // A repeating task is one task at its current date; its later dates show too, for planning.
            var dates = RecurrencePlanner.ToDto(t.RecurrenceRule) is { } rule && t.Status != TaskItemStatus.Completed
                ? RecurrenceSchedule.Occurrences(rule, t.DueDateUtc!.Value, zone, fromUtc, toUtc).Take(62)
                : t.DueDateUtc >= fromUtc ? [t.DueDateUtc!.Value] : [];
            items.AddRange(dates.Select(due => new CalendarItemDto(
                t.Id, "Task", t.Title, due, null, t.HasDueTime, t.Status.ToString(), t.Priority.ToString(), null, t.RecurrenceRule is not null)));
        }

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

            CalendarView.Week => WeekRange(anchor, timeZone, await FirstDayAsync(userId, ct)),

            CalendarView.Month => MonthRange(anchor, timeZone),

            _ => MonthRange(anchor, timeZone)
        };
    }

    /// <summary>Where the user's weeks begin (Settings - Calendar; Monday unless chosen).</summary>
    private async Task<DayOfWeek> FirstDayAsync(Guid userId, CancellationToken ct) =>
        CalendarSettingsDto.ToDay(await _db.UserSettings.Where(s => s.UserId == userId).Select(s => s.FirstDayOfWeek).FirstOrDefaultAsync(ct));

    /// <summary>The week containing <paramref name="anchor"/>, starting on <paramref name="firstDay"/>.</summary>
    public static (DateTime FromUtc, DateTime ToUtc) WeekRange(DateOnly anchor, TimeZoneInfo timeZone, DayOfWeek firstDay = DayOfWeek.Monday)
    {
        var back = ((int)anchor.DayOfWeek - (int)firstDay + 7) % 7;
        var weekStart = anchor.AddDays(-back);
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
