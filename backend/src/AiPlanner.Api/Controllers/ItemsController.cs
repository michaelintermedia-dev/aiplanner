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
    private readonly IItemDeletionService _deletion;

    public ItemsController(IItemConversionService conversion, IItemDeletionService deletion)
    {
        _conversion = conversion;
        _deletion = deletion;
    }

    /// <summary>POST /api/items/convert - change an item's type; returns the new item's type and id.</summary>
    [HttpPost("convert")]
    public async Task<ActionResult<ConvertedItemDto>> Convert(ConvertItemRequest request, CancellationToken ct)
    {
        var result = await _conversion.ConvertAsync(request, ct);
        if (result.Succeeded) return Ok(result.Value);
        return result.Errors.Contains("Item not found.") ? NotFound(new { errors = result.Errors }) : BadRequest(new { errors = result.Errors });
    }

    /// <summary>POST /api/items/delete - delete one or many items of any type; returns how many were deleted.</summary>
    [HttpPost("delete")]
    public async Task<ActionResult<ItemsResultDto>> Delete(ItemsRequest request, CancellationToken ct)
    {
        var result = await _deletion.DeleteAsync(request, ct);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { errors = result.Errors });
    }

    /// <summary>POST /api/items/restore - undo a delete; returns how many came back.</summary>
    [HttpPost("restore")]
    public async Task<ActionResult<ItemsResultDto>> Restore(ItemsRequest request, CancellationToken ct)
    {
        var result = await _deletion.RestoreAsync(request, ct);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { errors = result.Errors });
    }
}
