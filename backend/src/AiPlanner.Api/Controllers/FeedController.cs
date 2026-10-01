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
    /// kinds: comma-separated, omit for all. sort: CreatedDesc (default), CreatedAsc,
    /// UpdatedDesc, DateAsc. cursor: NextCursor from the previous page.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<FeedPageDto>> Get(
        [FromQuery] string? kinds,
        [FromQuery] FeedSort sort = FeedSort.CreatedDesc,
        [FromQuery] string? cursor = null,
        [FromQuery] int take = 30,
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

        return Ok(await _feed.GetPageAsync(new FeedQueryParameters(parsed, sort, cursor, take), ct));
    }
}
