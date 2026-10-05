using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Domain.Entities;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Recurrence;

/// <summary>
/// The one place that turns a RecurrenceDto into the item's RecurrenceRule row
/// and back. Until is stored in EndsOnUtc as a date (00:00, a local date - not
/// an instant); Days in ByDay as English weekday names ("Monday,Thursday").
/// </summary>
public static class RecurrencePlanner
{
    public static RecurrenceDto? ToDto(RecurrenceRule? rule) =>
        rule is null || rule.IsDeleted || rule.Frequency is RecurrenceFrequency.None or RecurrenceFrequency.Custom
            ? null
            : new RecurrenceDto(
                rule.Frequency,
                rule.Interval,
                rule.Frequency == RecurrenceFrequency.Weekly ? ParseDays(rule.ByDay) : null,
                rule.Frequency == RecurrenceFrequency.Monthly ? rule.ByMonthDay : null,
                rule.EndsOnUtc is { } until ? DateOnly.FromDateTime(until) : null,
                rule.MaxOccurrences);

    /// <summary>
    /// Makes <paramref name="spec"/> the item's rule (null = doesn't repeat):
    /// updates the existing row, adds one, or turns it off (soft delete, kept for sync).
    /// </summary>
    public static RecurrenceRule? Apply(IApplicationDbContext db, RecurrenceRule? existing, RecurrenceDto? spec, Guid userId)
    {
        if (spec is null)
        {
            if (existing is not null) existing.IsDeleted = true;
            return null;
        }
        var rule = existing is { IsDeleted: false } ? existing : new RecurrenceRule { UserId = userId };
        rule.Frequency = spec.Frequency;
        rule.Interval = spec.Frequency == RecurrenceFrequency.Weekdays ? 1 : Math.Max(1, spec.Interval);
        rule.ByDay = spec.Frequency == RecurrenceFrequency.Weekly && spec.Days is { Count: > 0 } days
            ? string.Join(',', days.Distinct().Order())
            : null;
        rule.ByMonthDay = spec.Frequency == RecurrenceFrequency.Monthly ? spec.MonthDay : null;
        rule.EndsOnUtc = spec.Until is { } until ? DateTime.SpecifyKind(until.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc) : null;
        rule.MaxOccurrences = spec.Count;
        if (!ReferenceEquals(rule, existing))
        {
            if (existing is not null) existing.IsDeleted = true;
            // Explicit Add: a pre-keyed entity attached only via a navigation would be UPDATEd (409).
            db.RecurrenceRules.Add(rule);
        }
        return rule;
    }

    /// <summary>
    /// Fills in what the rule takes from the item's date (Weekly's day, Monthly's
    /// day), so it stays the same when the date moves - a repeating task's due
    /// date moves on every time it's done ("the 31st" stays the 31st after April 30).
    /// </summary>
    public static RecurrenceDto? Pin(RecurrenceDto? spec, DateTime? itemUtc, TimeZoneInfo zone)
    {
        if (spec is null || itemUtc is not { } utc) return spec;
        var local = TimeZoneInfo.ConvertTimeFromUtc(utc, zone);
        return spec.Frequency switch
        {
            RecurrenceFrequency.Weekly when spec.Days is not { Count: > 0 } => spec with { Days = [local.DayOfWeek] },
            RecurrenceFrequency.Monthly when spec.MonthDay is null => spec with { MonthDay = local.Day },
            _ => spec,
        };
    }

    private static List<DayOfWeek>? ParseDays(string? byDay)
    {
        var days = (byDay ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(d => Enum.TryParse<DayOfWeek>(d, ignoreCase: true, out var day) ? day : (DayOfWeek?)null)
            .OfType<DayOfWeek>()
            .ToList();
        return days.Count > 0 ? days : null;
    }
}
