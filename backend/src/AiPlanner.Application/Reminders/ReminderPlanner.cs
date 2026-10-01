using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Utils;
using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Reminders;

/// <summary>
/// The one place that turns a ReminderDto into Reminder rows for any item.
/// Each item has at most one pending reminder; changing it turns the old one
/// off and adds a new row (kept for sync), unchanged ones are left alone.
/// </summary>
public class ReminderPlanner
{
    private readonly IApplicationDbContext _db;
    private readonly IDateTime _clock;

    public ReminderPlanner(IApplicationDbContext db, IDateTime clock)
    {
        _db = db;
        _clock = clock;
    }

    /// <summary>The user's timezone - repeating reminders run on their wall clock.</summary>
    public async Task<TimeZoneInfo> ZoneAsync(Guid userId, CancellationToken ct)
    {
        var id = await _db.Users.Where(u => u.Id == userId).Select(u => u.TimeZoneId).FirstOrDefaultAsync(ct);
        return UserTimeZoneHelper.ResolveTimeZone(id);
    }

    /// <summary>
    /// Makes <paramref name="spec"/> the item's reminder (null = none). A Before
    /// reminder follows <paramref name="itemTimeUtc"/>, so call this again when
    /// the item's time changes. <paramref name="attach"/> sets the owner's key.
    /// </summary>
    public void Set(ICollection<Reminder> reminders, ReminderDto? spec, DateTime? itemTimeUtc, TimeZoneInfo zone, Guid userId, Action<Reminder> attach)
    {
        var next = spec is null ? null : Build(spec, itemTimeUtc, zone, userId);
        var current = Pending(reminders);
        if (current is not null && next is not null && SameSchedule(current, next))
        {
            return;
        }

        TurnOff(reminders);
        if (next is not null)
        {
            attach(next);
            // Add explicitly: attached only through a tracked owner's navigation,
            // EF would treat the pre-keyed reminder as an existing row (UPDATE -> 409).
            _db.Reminders.Add(next);
            reminders.Add(next);
        }
    }

    /// <summary>On reopen, bring back the reminder that complete/cancel turned off - if it can still go off.</summary>
    public void Restore(ICollection<Reminder> reminders, DateTime? itemTimeUtc, TimeZoneInfo zone, Guid userId, Action<Reminder> attach)
    {
        var last = reminders.OrderByDescending(r => r.CreatedAtUtc).FirstOrDefault();
        if (last is null || !last.IsCancelled)
        {
            return;
        }
        var spec = ToDto(last);
        var next = Build(spec, itemTimeUtc, zone, userId);
        if (next is not null && next.TriggerAtUtc > _clock.UtcNow)
        {
            attach(next);
            _db.Reminders.Add(next);
            reminders.Add(next);
        }
    }

    public static void TurnOff(IEnumerable<Reminder> reminders)
    {
        foreach (var reminder in reminders.Where(r => !r.IsCancelled))
        {
            reminder.IsCancelled = true;
        }
    }

    /// <summary>The item's pending reminder as a DTO, or null.</summary>
    public static ReminderDto? ToDto(IEnumerable<Reminder> reminders) => Pending(reminders) is { } r ? ToDto(r) : null;

    private static ReminderDto ToDto(Reminder r) => new(
        r.Kind,
        AtUtc: r.Kind == Domain.Enums.ReminderKind.At ? r.TriggerAtUtc : null,
        MinutesBefore: r.MinutesBefore,
        Time: r.TimeOfDay is { } t ? ReminderSchedule.FormatTime(t) : null,
        Days: r.Kind == Domain.Enums.ReminderKind.Weekly ? ReminderSchedule.DaysFromMask(r.DaysOfWeek) : null,
        NextAtUtc: r.TriggerAtUtc);

    private static Reminder? Pending(IEnumerable<Reminder> reminders) =>
        reminders.Where(r => !r.IsCancelled).OrderByDescending(r => r.CreatedAtUtc).FirstOrDefault();

    private Reminder? Build(ReminderDto spec, DateTime? itemTimeUtc, TimeZoneInfo zone, Guid userId)
    {
        var repeats = ReminderSchedule.Repeats(spec.Kind);
        var time = repeats ? ReminderSchedule.ParseTime(spec.Time) : null;
        var days = spec.Kind == Domain.Enums.ReminderKind.Weekly ? ReminderSchedule.DaysMask(spec.Days) : 0;
        var minutes = spec.Kind == Domain.Enums.ReminderKind.Before ? spec.MinutesBefore : null;
        var trigger = ReminderSchedule.NextUtc(spec.Kind, spec.AtUtc, minutes, time, days, itemTimeUtc, _clock.UtcNow, zone);
        return trigger is null
            ? null
            : new Reminder { UserId = userId, Kind = spec.Kind, MinutesBefore = minutes, TimeOfDay = time, DaysOfWeek = days, TriggerAtUtc = trigger.Value };
    }

    private static bool SameSchedule(Reminder a, Reminder b) =>
        a.Kind == b.Kind
        && a.MinutesBefore == b.MinutesBefore
        && a.TimeOfDay == b.TimeOfDay
        && a.DaysOfWeek == b.DaysOfWeek
        && (ReminderSchedule.Repeats(a.Kind) || a.TriggerAtUtc == b.TriggerAtUtc);
}
