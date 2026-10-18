using AiPlanner.Application.Notifications.Push;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiPlanner.Api.Controllers;

/// <summary>Web push (2026-10-18): reminders in the browser with the tab closed.</summary>
[ApiController]
[Route("api/push")]
[Authorize]
public class PushController : ControllerBase
{
    private readonly PushSubscriptionService _subscriptions;
    private readonly IWebPushSender _sender;

    public PushController(PushSubscriptionService subscriptions, IWebPushSender sender)
    {
        _subscriptions = subscriptions;
        _sender = sender;
    }

    /// <summary>GET /api/push/key - the VAPID public key (null: web push is off on this server).</summary>
    [HttpGet("key")]
    public ActionResult Key() => Ok(new { publicKey = _sender.PublicKey });

    /// <summary>POST /api/push/subscriptions - this browser gets reminders.</summary>
    [HttpPost("subscriptions")]
    public async Task<ActionResult> Subscribe(PushSubscribeRequest request, CancellationToken ct)
    {
        if (!_sender.Enabled) return BadRequest(new { errors = new[] { "Web push is not set up on this server." } });
        await _subscriptions.SubscribeAsync(request, ct);
        return NoContent();
    }

    /// <summary>DELETE /api/push/subscriptions?endpoint=... - this browser stops getting them.</summary>
    [HttpDelete("subscriptions")]
    public async Task<ActionResult> Unsubscribe([FromQuery] string endpoint, CancellationToken ct)
    {
        await _subscriptions.UnsubscribeAsync(endpoint, ct);
        return NoContent();
    }
}
