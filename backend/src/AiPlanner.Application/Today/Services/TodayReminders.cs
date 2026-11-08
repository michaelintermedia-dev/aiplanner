using AiPlanner.Application.Notifications.DTOs;

namespace AiPlanner.Application.Today.Services;

/// <summary>
/// The Today screen's reminders list (user's request, 2026-11-08): one line per item - its next
/// reminder - not every time a daily reminder or each of an item's reminders goes off. Pure, tested.
/// </summary>
public static class TodayReminders
{
    public const int MaxShown = 20;

    public static IReadOnlyList<UpcomingNotificationDto> NearestPerItem(IEnumerable<UpcomingNotificationDto> upcoming) =>
        upcoming
            .Where(n => n.ItemType is not null && n.ItemId is not null)
            .GroupBy(n => (n.ItemType, n.ItemId))
            .Select(g => g.OrderBy(n => n.AtUtc).First())
            .OrderBy(n => n.AtUtc)
            .Take(MaxShown)
            .ToList();
}
