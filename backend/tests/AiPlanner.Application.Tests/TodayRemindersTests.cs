using AiPlanner.Application.Notifications.DTOs;
using AiPlanner.Application.Today.Services;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class TodayRemindersTests
{
    private static readonly DateTime T0 = new(2026, 11, 8, 9, 0, 0, DateTimeKind.Utc);
    private static readonly Guid Plants = Guid.NewGuid(), Dentist = Guid.NewGuid(), Rent = Guid.NewGuid();

    private static UpcomingNotificationDto At(int hours, string type, Guid? id, string title) =>
        new($"r:{title}:{hours}", "Reminder", T0.AddHours(hours), title, null, type, id, false);

    [Fact]
    public void One_line_per_item_with_its_next_reminder_soonest_first()
    {
        var list = new[]
        {
            At(0, "Note", Plants, "Water the plants"), At(24, "Note", Plants, "Water the plants"), At(48, "Note", Plants, "Water the plants"),
            At(30, "Appointment", Dentist, "Dentist"), At(29, "Appointment", Dentist, "Dentist"),
            At(5, "Task", Rent, "Pay rent"),
            new UpcomingNotificationDto("d:2026-11-09", "Summary", T0.AddHours(1), "Daily summary", null, null, null, false),
        };

        var shown = TodayReminders.NearestPerItem(list);

        shown.Select(n => (n.Title, n.AtUtc)).Should().Equal(
            ("Water the plants", T0), ("Pay rent", T0.AddHours(5)), ("Dentist", T0.AddHours(29)));
    }

    [Fact]
    public void Same_id_of_another_type_is_another_item()
    {
        var id = Guid.NewGuid();
        TodayReminders.NearestPerItem([At(1, "Task", id, "a"), At(2, "Note", id, "b")]).Should().HaveCount(2);
    }
}
