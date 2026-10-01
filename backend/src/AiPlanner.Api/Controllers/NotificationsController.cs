using AiPlanner.Application.Notifications.DTOs;
using AiPlanner.Application.Notifications.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiPlanner.Api.Controllers;

/// <summary>Phase 4: what should go off when. Clients schedule these as local notifications.</summary>
[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notifications;

    public NotificationsController(INotificationService notifications)
    {
        _notifications = notifications;
    }

    /// <summary>GET /api/notifications/upcoming?hours=168 - everything due to go off, soonest first.</summary>
    [HttpGet("upcoming")]
    public async Task<ActionResult<IReadOnlyList<UpcomingNotificationDto>>> Upcoming([FromQuery] int hours = 168, CancellationToken ct = default) =>
        Ok(await _notifications.GetUpcomingAsync(hours, ct));

    /// <summary>POST /api/notifications/snooze - remind me again about this item in N minutes.</summary>
    [HttpPost("snooze")]
    public async Task<ActionResult<UpcomingNotificationDto>> Snooze(SnoozeRequest request, CancellationToken ct)
    {
        var result = await _notifications.SnoozeAsync(request, ct);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { errors = result.Errors });
    }
}
