using AiPlanner.Application.Admin.DTOs;
using AiPlanner.Application.Admin.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiPlanner.Api.Controllers;

/// <summary>The operator's pages - only for accounts in Admin:Emails.</summary>
[ApiController]
[Route("api/admin")]
[Authorize]
public class AdminController : ControllerBase
{
    private readonly AiUsageReportService _usage;

    public AdminController(AiUsageReportService usage)
    {
        _usage = usage;
    }

    /// <summary>GET /api/admin/ai-usage?days=30 - what AI cost, in total, per user and per day.</summary>
    [HttpGet("ai-usage")]
    public async Task<ActionResult<AiUsageReportDto>> AiUsage([FromQuery] int days = 30, CancellationToken ct = default)
    {
        var result = await _usage.ReportAsync(days, ct);
        return result.Succeeded ? Ok(result.Value) : StatusCode(StatusCodes.Status403Forbidden, new { errors = result.Errors });
    }
}
