using System.Globalization;
using System.Text;
using AiPlanner.Application.Recurrence;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Calendar.Feed;

/// <summary>One entry of the calendar feed: an event, or a task with a date.</summary>
/// <param name="AllDay">A task with a date but no time: a whole day.</param>
/// <param name="Rule">How an event repeats (null: once); skipped dates become EXDATEs.</param>
public record IcsEntry(
    Guid Id,
    string Title,
    string? Description,
    string? Location,
    DateTime StartUtc,
    DateTime EndUtc,
    bool AllDay,
    RecurrenceDto? Rule,
    IReadOnlyList<DateTime> SkippedUtc,
    DateTime UpdatedUtc,
    string Url);

/// <summary>
/// The account as an iCalendar feed (RFC 5545; 2026-10-18) - Google, Apple and
/// Outlook calendars subscribe to it and show the events and dated tasks
/// read-only. Pure, unit tested. Repeating events are written in the user's
/// zone (TZID), so they keep their wall-clock time across daylight saving; the
/// rest in UTC. No alarms: Gatazee does the reminding itself.
/// </summary>
public static class IcsCalendar
{
    public static string Build(IEnumerable<IcsEntry> entries, string calendarName, TimeZoneInfo zone, string zoneId, DateTime nowUtc)
    {
        var lines = new List<string>
        {
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Gatazee//Calendar feed//EN",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            $"X-WR-CALNAME:{Escape(calendarName)}",
            $"X-WR-TIMEZONE:{zoneId}",
            "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
            "X-PUBLISHED-TTL:PT1H",
        };
        foreach (var e in entries)
        {
            lines.Add("BEGIN:VEVENT");
            lines.Add($"UID:{e.Id:N}@gatazee.com");
            lines.Add($"DTSTAMP:{Utc(nowUtc)}");
            lines.Add($"LAST-MODIFIED:{Utc(e.UpdatedUtc)}");
            if (e.AllDay)
            {
                var day = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(e.StartUtc, zone));
                lines.Add($"DTSTART;VALUE=DATE:{day:yyyyMMdd}");
                lines.Add($"DTEND;VALUE=DATE:{day.AddDays(1):yyyyMMdd}");
            }
            else if (e.Rule is not null)
            {
                lines.Add($"DTSTART;TZID={zoneId}:{Local(e.StartUtc, zone)}");
                lines.Add($"DTEND;TZID={zoneId}:{Local(e.EndUtc, zone)}");
                lines.Add($"RRULE:{Rule(e.Rule, e.StartUtc, zone)}");
                if (e.SkippedUtc.Count > 0) lines.Add($"EXDATE;TZID={zoneId}:{string.Join(',', e.SkippedUtc.Select(s => Local(s, zone)))}");
            }
            else
            {
                lines.Add($"DTSTART:{Utc(e.StartUtc)}");
                lines.Add($"DTEND:{Utc(e.EndUtc)}");
            }
            lines.Add($"SUMMARY:{Escape(e.Title)}");
            if (!string.IsNullOrWhiteSpace(e.Location)) lines.Add($"LOCATION:{Escape(e.Location)}");
            var description = string.IsNullOrWhiteSpace(e.Description) ? e.Url : $"{e.Description}\n\n{e.Url}";
            lines.Add($"DESCRIPTION:{Escape(description)}");
            lines.Add($"URL:{e.Url}");
            lines.Add("END:VEVENT");
        }
        lines.Add("END:VCALENDAR");

        var sb = new StringBuilder();
        foreach (var line in lines) Fold(line, sb);
        return sb.ToString();
    }

    /// <summary>The repeat as an RRULE ("FREQ=WEEKLY;BYDAY=MO,TH;UNTIL=...").</summary>
    public static string Rule(RecurrenceDto rule, DateTime firstUtc, TimeZoneInfo zone)
    {
        var first = TimeZoneInfo.ConvertTimeFromUtc(firstUtc, zone);
        var parts = new List<string>();
        switch (rule.Frequency)
        {
            case RecurrenceFrequency.Daily:
                parts.Add("FREQ=DAILY");
                break;
            case RecurrenceFrequency.Weekdays:
                parts.Add("FREQ=WEEKLY");
                parts.Add("BYDAY=MO,TU,WE,TH,FR");
                break;
            case RecurrenceFrequency.Weekly:
                parts.Add("FREQ=WEEKLY");
                var days = rule.Days is { Count: > 0 } d ? d : [first.DayOfWeek];
                parts.Add($"BYDAY={string.Join(',', days.Distinct().OrderBy(x => ((int)x + 6) % 7).Select(Day))}");
                break;
            case RecurrenceFrequency.Monthly:
                parts.Add("FREQ=MONTHLY");
                parts.Add($"BYMONTHDAY={rule.MonthDay ?? first.Day}");
                break;
        }
        if (rule.Interval > 1 && rule.Frequency != RecurrenceFrequency.Weekdays) parts.Add($"INTERVAL={rule.Interval}");
        if (rule.Count is { } count) parts.Add($"COUNT={count}");
        else if (rule.Until is { } until)
        {
            // The whole last day counts, in the user's zone.
            var end = TimeZoneInfo.ConvertTimeToUtc(until.ToDateTime(new TimeOnly(23, 59, 59)), zone);
            parts.Add($"UNTIL={Utc(end)}");
        }
        return string.Join(';', parts);
    }

    private static string Day(DayOfWeek d) => d switch
    {
        DayOfWeek.Monday => "MO",
        DayOfWeek.Tuesday => "TU",
        DayOfWeek.Wednesday => "WE",
        DayOfWeek.Thursday => "TH",
        DayOfWeek.Friday => "FR",
        DayOfWeek.Saturday => "SA",
        _ => "SU",
    };

    private static string Utc(DateTime utc) => DateTime.SpecifyKind(utc, DateTimeKind.Utc).ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);

    private static string Local(DateTime utc, TimeZoneInfo zone) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), zone).ToString("yyyyMMdd'T'HHmmss", CultureInfo.InvariantCulture);

    /// <summary>RFC 5545 text: backslash, semicolon and comma escaped; line breaks as \n.</summary>
    public static string Escape(string text) =>
        text.Replace("\\", "\\\\").Replace(";", "\\;").Replace(",", "\\,").Replace("\r\n", "\\n").Replace("\n", "\\n").Replace("\r", "\\n");

    /// <summary>Lines longer than 75 bytes continue on the next line after a space (never inside a character).</summary>
    private static void Fold(string line, StringBuilder sb)
    {
        var bytes = 0;
        var limit = 75;
        foreach (var rune in line.EnumerateRunes())
        {
            var size = rune.Utf8SequenceLength;
            if (bytes + size > limit)
            {
                sb.Append("\r\n ");
                bytes = 1;
                limit = 75;
            }
            sb.Append(rune.ToString());
            bytes += size;
        }
        sb.Append("\r\n");
    }
}
