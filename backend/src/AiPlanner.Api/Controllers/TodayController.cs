using AiPlanner.Application.Today.DTOs;
using AiPlanner.Application.Today.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiPlanner.Api.Controllers;

[ApiController]
[Route("api/today")]
[Authorize]
public class TodayController : ControllerBase
{
    private readonly ITodayService _todayService;

    public TodayController(ITodayService todayService)
    {
        _todayService = todayService;
    }

    /// <summary>GET /api/today?date=2026-09-29 (optional; defaults to "now" in the user's own timezone).</summary>
    [HttpGet]
    public async Task<ActionResult<TodayDto>> Get([FromQuery] DateOnly? date, CancellationToken ct)
    {
        return Ok(await _todayService.GetTodayAsync(date, ct));
    }
}
