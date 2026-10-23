using AiPlanner.Application.Calendar.Feed;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiPlanner.Api.Controllers;

/// <summary>
/// "Show in your phone's calendar" (2026-10-23): the private subscription link,
/// and the feed calendar apps read from it (no sign-in: the link is the key).
/// </summary>
[ApiController]
public class CalendarFeedController : ControllerBase
{
    private readonly CalendarFeedService _feed;

    public CalendarFeedController(CalendarFeedService feed)
    {
        _feed = feed;
    }

    private string AppUrl => $"{Request.Scheme}://{Request.Host}";
    private string? LinkFor(string? token) => token is null ? null : $"{AppUrl}/api/calendar/feed/{token}.ics";

    /// <summary>GET /api/settings/calendar-feed - the link, or null when it's off.</summary>
    [Authorize]
    [HttpGet("api/settings/calendar-feed")]
    public async Task<ActionResult> Get(CancellationToken ct) => Ok(new { url = LinkFor(await _feed.GetTokenAsync(ct)) });

    /// <summary>POST /api/settings/calendar-feed - a new link (the old one stops working).</summary>
    [Authorize]
    [HttpPost("api/settings/calendar-feed")]
    public async Task<ActionResult> New(CancellationToken ct) => Ok(new { url = LinkFor(await _feed.NewTokenAsync(ct)) });

    /// <summary>DELETE /api/settings/calendar-feed - turn it off.</summary>
    [Authorize]
    [HttpDelete("api/settings/calendar-feed")]
    public async Task<ActionResult> Off(CancellationToken ct)
    {
        await _feed.TurnOffAsync(ct);
        return NoContent();
    }

    /// <summary>GET /api/calendar/feed/{token}.ics - the feed itself (iCalendar).</summary>
    [AllowAnonymous]
    [HttpGet("api/calendar/feed/{token}.ics")]
    public async Task<ActionResult> Feed(string token, CancellationToken ct)
    {
        var ics = await _feed.BuildAsync(token, AppUrl, ct);
        if (ics is null) return NotFound();
        Response.Headers.CacheControl = "private, max-age=900";
        return Content(ics, "text/calendar; charset=utf-8");
    }
}
