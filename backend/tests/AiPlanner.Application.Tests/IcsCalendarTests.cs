using AiPlanner.Application.Calendar.Feed;
using AiPlanner.Application.Recurrence;
using AiPlanner.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class IcsCalendarTests
{
    private static readonly TimeZoneInfo Jerusalem = TimeZoneInfo.FindSystemTimeZoneById("Asia/Jerusalem");
    private static readonly DateTime Now = new(2026, 10, 23, 12, 0, 0, DateTimeKind.Utc);

    private static IcsEntry Entry(string title = "Dentist", bool allDay = false, RecurrenceDto? rule = null, IReadOnlyList<DateTime>? skipped = null,
        string? description = null) =>
        new(Guid.Parse("11111111-2222-3333-4444-555555555555"), title, description, "Dizengoff Center, Tel Aviv",
            new DateTime(2026, 10, 26, 13, 0, 0, DateTimeKind.Utc), new DateTime(2026, 10, 26, 14, 0, 0, DateTimeKind.Utc),
            allDay, rule, skipped ?? [], Now, "https://app.gatazee.com/appointments/1");

    private static string Build(params IcsEntry[] entries) => IcsCalendar.Build(entries, "Gatazee", Jerusalem, "Asia/Jerusalem", Now);

    [Fact]
    public void A_one_off_event_in_UTC_with_its_place_escaped_and_no_alarm()
    {
        var ics = Build(Entry());
        ics.Should().StartWith("BEGIN:VCALENDAR\r\n").And.EndWith("END:VCALENDAR\r\n");
        ics.Should().Contain("DTSTART:20261026T130000Z\r\n").And.Contain("DTEND:20261026T140000Z\r\n");
        ics.Should().Contain(@"LOCATION:Dizengoff Center\, Tel Aviv" + "\r\n");
        ics.Should().Contain("UID:11111111222233334444555555555555@gatazee.com").And.NotContain("VALARM");
    }

    [Fact]
    public void A_task_with_a_date_but_no_time_is_a_whole_day_on_its_local_date()
    {
        // 21:00 UTC on the 25th is midnight of the 26th in Jerusalem (winter, UTC+2).
        var task = Entry(allDay: true) with { StartUtc = new DateTime(2026, 10, 25, 22, 0, 0, DateTimeKind.Utc) };
        Build(task).Should().Contain("DTSTART;VALUE=DATE:20261026\r\n").And.Contain("DTEND;VALUE=DATE:20261027\r\n");
    }

    [Fact]
    public void A_repeating_event_keeps_its_local_time_with_rule_and_skipped_dates()
    {
        var rule = new RecurrenceDto(RecurrenceFrequency.Weekly, 1, [DayOfWeek.Thursday, DayOfWeek.Monday], Until: new DateOnly(2026, 12, 31));
        var ics = Build(Entry(rule: rule, skipped: [new DateTime(2026, 11, 2, 13, 0, 0, DateTimeKind.Utc)]));
        ics.Should().Contain("DTSTART;TZID=Asia/Jerusalem:20261026T150000\r\n");
        ics.Should().Contain("RRULE:FREQ=WEEKLY;BYDAY=MO,TH;UNTIL=20261231T215959Z\r\n");
        ics.Should().Contain("EXDATE;TZID=Asia/Jerusalem:20261102T150000\r\n");
    }

    [Theory]
    [InlineData(RecurrenceFrequency.Daily, 2, null, "FREQ=DAILY;INTERVAL=2")]
    [InlineData(RecurrenceFrequency.Weekdays, 1, null, "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR")]
    [InlineData(RecurrenceFrequency.Monthly, 1, 3, "FREQ=MONTHLY;BYMONTHDAY=26;COUNT=3")]
    public void Rules(RecurrenceFrequency frequency, int interval, int? count, string expected) =>
        IcsCalendar.Rule(new RecurrenceDto(frequency, interval, Count: count), new DateTime(2026, 10, 26, 13, 0, 0, DateTimeKind.Utc), Jerusalem)
            .Should().Be(expected);

    [Fact]
    public void Long_lines_fold_at_75_bytes_without_splitting_a_character()
    {
        var ics = Build(Entry(title: new string('ש', 60), description: "line one\nline two; with, marks"));
        foreach (var line in ics.Split("\r\n")) System.Text.Encoding.UTF8.GetByteCount(line).Should().BeLessThanOrEqualTo(75);
        ics.Replace("\r\n ", "").Should().Contain(@"line one\nline two\; with\, marks");
        // Unfolded, the title is whole again.
        ics.Replace("\r\n ", "").Should().Contain("SUMMARY:" + new string('ש', 60));
    }
}
