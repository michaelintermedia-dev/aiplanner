using AiPlanner.Application.Attachments;
using AiPlanner.Application.Attachments.DTOs;
using AiPlanner.Application.Attachments.Interfaces;
using AiPlanner.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiPlanner.Api.Controllers;

/// <summary>An item's media: photos and documents.</summary>
[ApiController]
[Route("api")]
[Authorize]
public class AttachmentsController : ControllerBase
{
    private const long UploadLimit = AttachmentRules.MaxFileBytes + 1024 * 1024;

    private readonly IAttachmentService _attachments;

    public AttachmentsController(IAttachmentService attachments)
    {
        _attachments = attachments;
    }

    /// <summary>GET /api/items/{itemType}/{itemId}/attachments - the item's attachments, oldest first.</summary>
    [HttpGet("items/{itemType:regex(^(Task|Appointment|Note)$)}/{itemId:guid}/attachments")]
    public async Task<ActionResult<IReadOnlyList<AttachmentDto>>> List(string itemType, Guid itemId, CancellationToken ct)
    {
        var result = await _attachments.ListAsync(itemType, itemId, ct);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { errors = result.Errors });
    }

    /// <summary>POST /api/items/{itemType}/{itemId}/attachments - upload one file (form field "file").</summary>
    [HttpPost("items/{itemType:regex(^(Task|Appointment|Note)$)}/{itemId:guid}/attachments")]
    [RequestSizeLimit(UploadLimit)]
    [RequestFormLimits(MultipartBodyLengthLimit = UploadLimit)]
    public async Task<ActionResult<AttachmentDto>> Upload(string itemType, Guid itemId, IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { errors = new[] { "Attach the file as form field \"file\"." } });
        }
        await using var stream = file.OpenReadStream();
        var result = await _attachments.AddAsync(itemType, itemId, file.FileName, file.Length, stream, ct);
        if (result.Succeeded) return Created($"/api/attachments/{result.Value!.Id}/content", result.Value);
        return result.Errors.Contains("Item not found.") ? NotFound(new { errors = result.Errors }) : BadRequest(new { errors = result.Errors });
    }

    /// <summary>
    /// GET /api/attachments/{id}/content - the file. Photos are sent to show;
    /// documents always as a download, and the browser may not run anything in
    /// them (sandbox), whatever is inside.
    /// </summary>
    [HttpGet("attachments/{id:guid}/content")]
    public async Task<IActionResult> Content(Guid id, CancellationToken ct)
    {
        var result = await _attachments.OpenAsync(id, ct);
        if (!result.Succeeded) return NotFound(new { errors = result.Errors });

        var file = result.Value!;
        Response.Headers["Content-Security-Policy"] = "sandbox; default-src 'none'";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        Response.Headers.CacheControl = "private, max-age=86400";
        return file.Kind == AttachmentKind.Image
            ? File(file.Content, file.ContentType, enableRangeProcessing: true)
            : File(file.Content, file.ContentType, file.FileName, enableRangeProcessing: true);
    }

    /// <summary>DELETE /api/attachments/{id} - remove it (the file is deleted).</summary>
    [HttpDelete("attachments/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await _attachments.DeleteAsync(id, ct);
        return result.Succeeded ? NoContent() : NotFound(new { errors = result.Errors });
    }
}
