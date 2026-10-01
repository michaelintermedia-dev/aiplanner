using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Utils;
using AiPlanner.Domain.Entities;
using AiPlanner.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Reminders;

/// <summary>
/// The one place that turns ReminderDtos into Reminder rows for any item. An
/// item can have several reminders. Setting the list keeps the ones that are
/// unchanged, turns off the ones that are gone (rows are kept for sync) and
/// adds the new ones.
/// </summary>
public class ReminderPlanner
{
    public const int MaxPerItem = 10;

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
    /// Makes <paramref name="specs"/> the item's reminders (null/empty = none).
    /// "Before" reminders follow <paramref name="itemTimeUtc"/>, so call this
    /// again when the item's time changes. <paramref name="attach"/> sets the owner's key.
    /// </summary>
    public void Set(ICollection<Reminder> reminders, IEnumerable<ReminderDto>? specs, DateTime? itemTimeUtc, TimeZoneInfo zone, Guid userId, Action<Reminder> attach)
    {
        var wanted = (specs ?? [])
            .Take(MaxPerItem)
            .Select(s => Build(s, itemTimeUtc, zone, userId))
            .OfType<Reminder>()
            .ToList();

        foreach (var current in reminders.Where(r => !r.IsCancelled).ToList())
        {
            var same = wanted.FirstOrDefault(w => SameSchedule(current, w));
            if (same is not null)
            {
                wanted.Remove(same); // unchanged - keep the existing row
            }
            else
            {
                current.IsCancelled = true;
            }
        }

        foreach (var next in wanted.DistinctBy(ScheduleKey))
        {
            Add(reminders, next, attach);
        }
    }

    /// <summary>Turns all of the item's reminders off. <paramref name="pausedWithItem"/>: it was completed/cancelled, so reopening restores them.</summary>
    public static void TurnOff(IEnumerable<Reminder> reminders, bool pausedWithItem = false)
    {
        foreach (var reminder in reminders.Where(r => !r.IsCancelled))
        {
            reminder.IsCancelled = true;
            reminder.PausedWithItem = pausedWithItem;
        }
    }

    /// <summary>On reopen, bring back the reminders complete/cancel paused - those that can still go off.</summary>
    public void Restore(ICollection<Reminder> reminders, DateTime? itemTimeUtc, TimeZoneInfo zone, Guid userId, Action<Reminder> attach)
    {
        foreach (var paused in reminders.Where(r => r.IsCancelled && r.PausedWithItem).ToList())
        {
            paused.PausedWithItem = false;
            var next = Build(ToDto(paused), itemTimeUtc, zone, userId);
            if (next is not null && next.TriggerAtUtc > _clock.UtcNow)
            {
                Add(reminders, next, attach);
            }
        }
    }

    /// <summary>The item's active reminders, soonest first.</summary>
    public static IReadOnlyList<ReminderDto> ToDtos(IEnumerable<Reminder> reminders) =>
        reminders.Where(r => !r.IsCancelled).OrderBy(r => r.TriggerAtUtc).Select(ToDto).ToList();

    public static ReminderDto ToDto(Reminder r) => new(
        r.Kind,
        AtUtc: r.Kind == ReminderKind.At ? r.TriggerAtUtc : null,
        MinutesBefore: r.MinutesBefore,
        Time: r.TimeOfDay is { } t ? ReminderSchedule.FormatTime(t) : null,
        Days: r.Kind == ReminderKind.Weekly ? ReminderSchedule.DaysFromMask(r.DaysOfWeek) : null,
        NextAtUtc: r.TriggerAtUtc);

    // ---- proposals on capture items (stored as JSON) ----

    public static List<ProposedReminder> ToProposed(IEnumerable<ReminderDto>? specs) =>
        (specs ?? []).Take(MaxPerItem).Select(s => new ProposedReminder
        {
            Kind = s.Kind,
            AtUtc = s.Kind == ReminderKind.At ? s.AtUtc : null,
            MinutesBefore = s.Kind == ReminderKind.Before ? s.MinutesBefore : null,
            TimeOfDay = ReminderSchedule.Repeats(s.Kind) ? ReminderSchedule.ParseTime(s.Time) : null,
            DaysOfWeek = s.Kind == ReminderKind.Weekly ? ReminderSchedule.DaysMask(s.Days) : 0,
        }).ToList();

    public static IReadOnlyList<ReminderDto> FromProposed(IEnumerable<ProposedReminder> proposed) =>
        proposed.Select(p => new ReminderDto(
            p.Kind,
            AtUtc: p.AtUtc,
            MinutesBefore: p.MinutesBefore,
            Time: p.TimeOfDay is { } t ? ReminderSchedule.FormatTime(t) : null,
            Days: p.Kind == ReminderKind.Weekly ? ReminderSchedule.DaysFromMask(p.DaysOfWeek) : null)).ToList();

    /// <summary>Order-insensitive comparison of two reminder lists (ignores NextAtUtc).</summary>
    public static bool SameList(IEnumerable<ReminderDto>? a, IEnumerable<ReminderDto>? b) =>
        (a ?? []).Select(Key).Order().SequenceEqual((b ?? []).Select(Key).Order());

    private static string Key(ReminderDto r) =>
        $"{r.Kind}|{r.AtUtc:O}|{r.MinutesBefore}|{r.Time}|{ReminderSchedule.DaysMask(r.Days)}";

    // ---- internals ----

    private void Add(ICollection<Reminder> reminders, Reminder next, Action<Reminder> attach)
    {
        attach(next);
        // Add explicitly: attached only through a tracked owner's navigation,
        // EF would treat the pre-keyed reminder as an existing row (UPDATE -> 409).
        _db.Reminders.Add(next);
        // For a tracked owner EF's relationship fix-up has already added it.
        if (!reminders.Contains(next))
        {
            reminders.Add(next);
        }
    }

    private Reminder? Build(ReminderDto spec, DateTime? itemTimeUtc, TimeZoneInfo zone, Guid userId)
    {
        var repeats = ReminderSchedule.Repeats(spec.Kind);
        var time = repeats ? ReminderSchedule.ParseTime(spec.Time) : null;
        var days = spec.Kind == ReminderKind.Weekly ? ReminderSchedule.DaysMask(spec.Days) : 0;
        var minutes = spec.Kind == ReminderKind.Before ? spec.MinutesBefore : null;
        var trigger = ReminderSchedule.NextUtc(spec.Kind, spec.AtUtc, minutes, time, days, itemTimeUtc, _clock.UtcNow, zone);
        return trigger is null
            ? null
            : new Reminder { UserId = userId, Kind = spec.Kind, MinutesBefore = minutes, TimeOfDay = time, DaysOfWeek = days, TriggerAtUtc = trigger.Value };
    }

    private static string ScheduleKey(Reminder r) =>
        $"{r.Kind}|{r.MinutesBefore}|{r.TimeOfDay}|{r.DaysOfWeek}|{(ReminderSchedule.Repeats(r.Kind) ? "" : r.TriggerAtUtc.ToString("O"))}";

    private static bool SameSchedule(Reminder a, Reminder b) => ScheduleKey(a) == ScheduleKey(b);
}
