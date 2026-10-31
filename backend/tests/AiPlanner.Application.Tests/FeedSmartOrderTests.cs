using AiPlanner.Application.Feed.DTOs;
using AiPlanner.Application.Feed.Services;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

/// <summary>The Smart order (spec v2, 2026-10-31): sections, each in its own order.</summary>
public class FeedSmartOrderTests
{
    private static readonly DateTime TodayStart = new(2026, 10, 31, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime TodayEnd = TodayStart.AddDays(1);

    private static FeedSection Section(FeedKind kind, DateTime? date, bool done = false) =>
        FeedPager.SectionOf(kind, date, done, TodayStart, TodayEnd);

    [Fact]
    public void Each_item_finds_its_section()
    {
        Section(FeedKind.Task, TodayStart.AddDays(-2)).Should().Be(FeedSection.Overdue);
        Section(FeedKind.Task, TodayStart.AddHours(9)).Should().Be(FeedSection.Today);
        Section(FeedKind.Task, TodayStart, done: false).Should().Be(FeedSection.Today, "an all-day task for today is today, not overdue");
        Section(FeedKind.Task, TodayEnd).Should().Be(FeedSection.Upcoming);
        Section(FeedKind.Task, null).Should().Be(FeedSection.NoDate);
        Section(FeedKind.Task, TodayStart.AddDays(-2), done: true).Should().Be(FeedSection.Done);
        Section(FeedKind.Appointment, TodayStart.AddDays(-1)).Should().Be(FeedSection.Today, "an event that started before today and isn't over is on now");
        Section(FeedKind.Appointment, TodayStart.AddHours(8), done: true).Should().Be(FeedSection.Done, "a passed event is done");
        Section(FeedKind.Note, null).Should().Be(FeedSection.Notes);
    }

    private static FeedKeyRow Row(string name, FeedKind kind, DateTime? date, bool done = false, bool high = false, int createdHoursAgo = 0) =>
        new(GuidOf(name), kind, TodayStart.AddHours(-createdHoursAgo), TodayStart.AddHours(-createdHoursAgo), date, high,
            Section: FeedPager.SectionOf(kind, date, done, TodayStart, TodayEnd));

    private static Guid GuidOf(string name) => new(System.Security.Cryptography.MD5.HashData(System.Text.Encoding.UTF8.GetBytes(name)));

    private static readonly List<FeedKeyRow> Rows =
    [
        Row("note old", FeedKind.Note, null, createdHoursAgo: 50),
        Row("done task", FeedKind.Task, TodayStart.AddDays(-1), done: true),
        Row("upcoming far", FeedKind.Task, TodayStart.AddDays(5)),
        Row("today 16", FeedKind.Appointment, TodayStart.AddHours(16)),
        Row("overdue 1d", FeedKind.Task, TodayStart.AddDays(-1)),
        Row("no date new", FeedKind.Task, null, createdHoursAgo: 1),
        Row("today 9", FeedKind.Task, TodayStart.AddHours(9)),
        Row("note new", FeedKind.Note, null, createdHoursAgo: 2),
        Row("overdue 3d", FeedKind.Task, TodayStart.AddDays(-3)),
        Row("passed event", FeedKind.Appointment, TodayStart.AddDays(-2), done: true),
        Row("upcoming soon", FeedKind.Appointment, TodayStart.AddDays(1)),
        Row("no date old", FeedKind.Task, null, createdHoursAgo: 30),
    ];

    private static List<string> Names(IEnumerable<FeedKeyRow> rows) =>
        rows.Select(r => Rows.Concat(PriorityRows).First(x => x.Id == r.Id)).Select(r => NameOf[r.Id]).ToList();

    private static readonly List<FeedKeyRow> PriorityRows =
    [
        Row("today low", FeedKind.Task, TodayStart.AddHours(8)),
        Row("today high", FeedKind.Task, TodayStart.AddHours(20), high: true),
    ];

    private static readonly Dictionary<Guid, string> NameOf = new[]
    {
        "note old", "done task", "upcoming far", "today 16", "overdue 1d", "no date new", "today 9", "note new",
        "overdue 3d", "passed event", "upcoming soon", "no date old", "today low", "today high",
    }.ToDictionary(GuidOf);

    [Fact]
    public void Sections_in_order_each_sorted_its_own_way()
    {
        var (page, next) = FeedPager.Page(Rows, [FeedSort.Smart], null, 100);
        next.Should().BeNull();
        Names(page).Should().Equal(
            "overdue 3d", "overdue 1d", // longest overdue first
            "today 9", "today 16", // by time
            "upcoming soon", "upcoming far", // soonest first
            "no date new", "no date old", // newest first
            "note new", "note old", // newest first
            "done task", "passed event"); // most recent first
    }

    [Fact]
    public void Paging_through_the_sections_sees_every_item_once_in_the_same_order()
    {
        var all = new List<FeedKeyRow>();
        string? cursor = null;
        do
        {
            var (page, next) = FeedPager.Page(Rows, [FeedSort.Smart], cursor, 3);
            all.AddRange(page);
            cursor = next;
        } while (cursor is not null);

        Names(all).Should().Equal(Names(FeedPager.Page(Rows, [FeedSort.Smart], null, 100).Page));
    }

    [Fact]
    public void High_priority_first_inside_each_section_not_across_them()
    {
        var rows = Rows.Concat(PriorityRows).ToList();
        var names = Names(FeedPager.Page(rows, [FeedSort.Smart, FeedSort.PriorityHigh], null, 100).Page);
        names.IndexOf("today high").Should().BeLessThan(names.IndexOf("today low"));
        names.IndexOf("today high").Should().BeGreaterThan(names.IndexOf("overdue 1d"), "overdue still comes first");
        names.IndexOf("today low").Should().BeLessThan(names.IndexOf("today 9"), "then by time");
    }
}
