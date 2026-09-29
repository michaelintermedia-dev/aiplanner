using AiPlanner.Application.Calendar.DTOs;
using AiPlanner.Application.Calendar.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiPlanner.Api.Controllers;

[ApiController]
[Route("api/calendar")]
[Authorize]
public class CalendarController : ControllerBase
{
    private readonly ICalendarService _calendarService;

    public CalendarController(ICalendarService calendarService)
    {
        _calendarService = calendarService;
    }

    /// <summary>
    /// GET /api/calendar?view=day|week|month&amp;date=2026-09-29
    /// or GET /api/calendar?from=...&amp;to=... for an explicit UTC range.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<CalendarRangeDto>> Get(
        [FromQuery] CalendarView? view,
        [FromQuery] DateOnly? date,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken ct)
    {
        var query = new CalendarQueryParameters(view, date, from, to);
        return Ok(await _calendarService.GetRangeAsync(query, ct));
    }
}
