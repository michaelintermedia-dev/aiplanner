using AiPlanner.Application.Items.DTOs;
using AiPlanner.Application.Items.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiPlanner.Api.Controllers;

/// <summary>Operations that work on any kind of item (task, event or note).</summary>
[ApiController]
[Route("api/items")]
[Authorize]
public class ItemsController : ControllerBase
{
    private readonly IItemConversionService _conversion;

    public ItemsController(IItemConversionService conversion)
    {
        _conversion = conversion;
    }

    /// <summary>POST /api/items/convert - change an item's type; returns the new item's type and id.</summary>
    [HttpPost("convert")]
    public async Task<ActionResult<ConvertedItemDto>> Convert(ConvertItemRequest request, CancellationToken ct)
    {
        var result = await _conversion.ConvertAsync(request, ct);
        if (result.Succeeded) return Ok(result.Value);
        return result.Errors.Contains("Item not found.") ? NotFound(new { errors = result.Errors }) : BadRequest(new { errors = result.Errors });
    }
}
