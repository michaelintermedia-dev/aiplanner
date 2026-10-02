using AiPlanner.Application.Feed.DTOs;
using AiPlanner.Application.Feed.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiPlanner.Api.Controllers;

/// <summary>The unified feed of tasks, appointments ("events") and notes.</summary>
[ApiController]
[Route("api/feed")]
[Authorize]
public class FeedController : ControllerBase
{
    private readonly IFeedService _feed;

    public FeedController(IFeedService feed)
    {
        _feed = feed;
    }

    /// <summary>
    /// GET /api/feed?kinds=Task,Appointment,Note&amp;sort=CreatedDesc&amp;cursor=&amp;take=30
    /// kinds: comma-separated, omit for all. sort: one or more (comma-separated, applied
    /// in order) of CreatedDesc (default), CreatedAsc, UpdatedDesc, DateAsc, PriorityHigh.
    /// cursor: NextCursor from the previous page.
    /// Filters (all optional, combined with AND, applied within the kinds):
    /// q (text), createdFrom/createdTo (UTC), reminders (Any/With/Repeating/Without),
    /// status (Any/Open/Done), dateFrom/dateTo (UTC, due/start), noDate, fromVoice,
    /// tags (comma-separated, any of; tasks only).
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<FeedPageDto>> Get(
        [FromQuery] string? kinds,
        [FromQuery] string? sort = null,
        [FromQuery] string? cursor = null,
        [FromQuery] int take = 30,
        [FromQuery] string? q = null,
        [FromQuery] DateTime? createdFrom = null,
        [FromQuery] DateTime? createdTo = null,
        [FromQuery] FeedReminderFilter reminders = FeedReminderFilter.Any,
        [FromQuery] FeedStatusFilter status = FeedStatusFilter.Any,
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null,
        [FromQuery] bool noDate = false,
        [FromQuery] bool fromVoice = false,
        [FromQuery] string? tags = null,
        CancellationToken ct = default)
    {
        var parsed = new List<FeedKind>();
        foreach (var part in (kinds ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (!Enum.TryParse<FeedKind>(part, ignoreCase: true, out var kind) || !Enum.IsDefined(kind))
            {
                return BadRequest(new { errors = new[] { $"Unknown kind '{part}'. Use Task, Appointment or Note." } });
            }
            parsed.Add(kind);
        }

        var sorts = new List<FeedSort>();
        foreach (var part in (sort ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (!Enum.TryParse<FeedSort>(part, ignoreCase: true, out var s) || !Enum.IsDefined(s))
            {
                return BadRequest(new { errors = new[] { $"Unknown sort '{part}'." } });
            }
            if (!sorts.Contains(s)) sorts.Add(s);
        }

        if (q?.Length > 200)
        {
            return BadRequest(new { errors = new[] { "The search text is too long." } });
        }

        static DateTime? Utc(DateTime? d) => d is { } v ? (v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime()) : null;
        var tagList = (tags ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var filter = new FeedFilter(q, Utc(createdFrom), Utc(createdTo), reminders, status, Utc(dateFrom), Utc(dateTo), noDate, fromVoice, tagList);
        return Ok(await _feed.GetPageAsync(new FeedQueryParameters(parsed, sorts, cursor, take, filter), ct));
    }

    /// <summary>GET /api/feed/tags - the user's tags in use, most used first.</summary>
    [HttpGet("tags")]
    public async Task<ActionResult<IReadOnlyList<FeedTagDto>>> Tags(CancellationToken ct) => Ok(await _feed.GetTagsAsync(ct));
}
