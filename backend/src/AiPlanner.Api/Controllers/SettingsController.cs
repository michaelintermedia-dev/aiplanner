using AiPlanner.Application.Notifications.DTOs;
using AiPlanner.Application.Settings.DTOs;
using AiPlanner.Application.Settings.Services;
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

    /// <summary>GET /api/settings/recordings - how voice recordings are saved.</summary>
    [HttpGet("recordings")]
    public async Task<ActionResult<RecordingSettingsDto>> GetRecordings([FromServices] RecordingSettingsService recordings, CancellationToken ct) =>
        Ok(await recordings.GetAsync(ct));

    /// <summary>PUT /api/settings/recordings</summary>
    [HttpPut("recordings")]
    public async Task<ActionResult<RecordingSettingsDto>> UpdateRecordings(RecordingSettingsDto settings, [FromServices] RecordingSettingsService recordings, CancellationToken ct) =>
        Ok(await recordings.UpdateAsync(settings, ct));

    [HttpPut("notifications")]
    public async Task<ActionResult<NotificationSettingsDto>> UpdateNotifications(NotificationSettingsDto settings, CancellationToken ct) =>
        Ok(await _notifications.UpdateSettingsAsync(settings, ct));
}
