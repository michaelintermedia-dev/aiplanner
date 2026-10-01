using AiPlanner.Application.Notifications.DTOs;
using AiPlanner.Application.Notifications.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiPlanner.Api.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize]
public class SettingsController : ControllerBase
{
    private readonly INotificationService _notifications;

    public SettingsController(INotificationService notifications)
    {
        _notifications = notifications;
    }

    [HttpGet("notifications")]
    public async Task<ActionResult<NotificationSettingsDto>> GetNotifications(CancellationToken ct) =>
        Ok(await _notifications.GetSettingsAsync(ct));

    [HttpPut("notifications")]
    public async Task<ActionResult<NotificationSettingsDto>> UpdateNotifications(NotificationSettingsDto settings, CancellationToken ct) =>
        Ok(await _notifications.UpdateSettingsAsync(settings, ct));
}
