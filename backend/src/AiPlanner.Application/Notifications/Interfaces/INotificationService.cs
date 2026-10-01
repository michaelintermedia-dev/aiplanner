using AiPlanner.Application.Common.Models;
using AiPlanner.Application.Notifications.DTOs;

namespace AiPlanner.Application.Notifications.Interfaces;

public interface INotificationService
{
    /// <summary>Everything that should go off for the current user in the next <paramref name="hours"/> hours, soonest first.</summary>
    Task<IReadOnlyList<UpcomingNotificationDto>> GetUpcomingAsync(int hours, CancellationToken ct = default);

    Task<Result<UpcomingNotificationDto>> SnoozeAsync(SnoozeRequest request, CancellationToken ct = default);

    Task<NotificationSettingsDto> GetSettingsAsync(CancellationToken ct = default);

    Task<NotificationSettingsDto> UpdateSettingsAsync(NotificationSettingsDto settings, CancellationToken ct = default);
}
