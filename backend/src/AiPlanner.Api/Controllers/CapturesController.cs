using Microsoft.AspNetCore.RateLimiting;
using AiPlanner.Application.Captures.DTOs;
using AiPlanner.Application.Captures.Interfaces;
using AiPlanner.Application.Captures.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiPlanner.Api.Controllers;

/// <summary>
/// Quick capture (spec sections 14-21): send text or a voice recording, get
/// back what the AI understood, then confirm to save.
/// </summary>
[ApiController]
[Route("api/captures")]
[Authorize]
public class CapturesController : ControllerBase
{
    /// <summary>OpenAI's upload limit for transcription (per file).</summary>
    private const long MaxAudioBytes = 25 * 1024 * 1024;
    private const long MaxTotalBytes = 50 * 1024 * 1024;

    private readonly ICaptureService _captures;

    public CapturesController(ICaptureService captures)
    {
        _captures = captures;
    }

    /// <summary>
    /// GET /api/captures?take=50 - capture history, newest first.
    /// &amp;pendingDays=7: only captures from the last 7 days with a review left unsaved.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CaptureSummaryDto>>> GetList(
        [FromQuery] int take = 50, [FromQuery] int? pendingDays = null, CancellationToken ct = default) =>
        Ok(await _captures.GetListAsync(take, ct, pendingDays));

    /// <summary>POST /api/captures/pending/discard - rejects every unsaved proposal; returns how many.</summary>
    [HttpPost("pending/discard")]
    public async Task<ActionResult<int>> DiscardPending(CancellationToken ct) =>
        Ok(await _captures.DiscardPendingAsync(ct));

    /// <summary>POST /api/captures/for-item - the capture an item's voice/text additions go into (made if it has none).</summary>
    [HttpPost("for-item")]
    public async Task<ActionResult<CaptureDto>> ForItem(CaptureForItemRequest request, CancellationToken ct)
    {
        var result = await _captures.ForItemAsync(request.ItemType, request.ItemId, ct);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { errors = result.Errors });
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CaptureDto>> GetById(Guid id, CancellationToken ct)
    {
        var result = await _captures.GetByIdAsync(id, ct);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { errors = result.Errors });
    }

    /// <summary>POST /api/captures/text - analyze typed text. Nothing is saved as a task/appointment yet.</summary>
    [HttpPost("text")]
    [EnableRateLimiting("ai")] // costs OpenAI calls
    public async Task<ActionResult<CaptureDto>> CaptureText(CaptureTextRequest request, CancellationToken ct)
    {
        var result = await _captures.CaptureTextAsync(request, ct);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { errors = result.Errors });
    }

    /// <summary>
    /// POST /api/captures/voice (multipart/form-data) - transcribe and analyze a
    /// recording. Send one "audio" field, or several in speaking order (the
    /// mobile app sends one per recorded segment).
    /// </summary>
    [HttpPost("voice")]
    [EnableRateLimiting("ai")] // costs OpenAI calls
    [RequestSizeLimit(MaxTotalBytes + 256 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxAudioBytes + 64 * 1024)]
    public async Task<ActionResult<CaptureDto>> CaptureVoice([FromForm] List<IFormFile> audio, CancellationToken ct)
    {
        var files = audio.Where(f => f.Length > 0).ToList();
        if (files.Count == 0)
        {
            return BadRequest(new { errors = new[] { "Attach the recording as form field \"audio\"." } });
        }
        if (files.Count > CaptureService.MaxSegments)
        {
            return BadRequest(new { errors = new[] { $"Too many parts (max {CaptureService.MaxSegments})." } });
        }
        if (files.Any(f => f.Length > MaxAudioBytes) || files.Sum(f => f.Length) > MaxTotalBytes)
        {
            return BadRequest(new { errors = new[] { "The recording is too large (max 25 MB per part)." } });
        }
        if (files.Any(f => !CaptureService.IsSupportedAudioFile(f.FileName)))
        {
            return BadRequest(new { errors = new[] { "Unsupported audio format. Use m4a, mp3, wav, webm, ogg, flac or aac." } });
        }

        var streams = files.Select(f => f.OpenReadStream()).ToList();
        try
        {
            var segments = files.Select((f, i) => new AudioSegment(streams[i], f.FileName, f.ContentType)).ToList();
            var result = await _captures.CaptureVoiceAsync(segments, ct);
            return result.Succeeded ? Ok(result.Value) : BadRequest(new { errors = result.Errors });
        }
        finally
        {
            foreach (var s in streams) await s.DisposeAsync();
        }
    }

    /// <summary>
    /// POST /api/captures/{id}/continue (multipart/form-data) - add to an existing
    /// capture: "audio" field(s) and/or "text", plus optional "itemType"/"itemId"
    /// of the saved item being continued. Returns the capture with new items to review.
    /// </summary>
    [HttpPost("{id:guid}/continue")]
    [EnableRateLimiting("ai")] // costs OpenAI calls
    [RequestSizeLimit(MaxTotalBytes + 256 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxAudioBytes + 64 * 1024)]
    public async Task<ActionResult<CaptureDto>> Continue(
        Guid id,
        [FromForm] List<IFormFile>? audio,
        [FromForm] string? text,
        [FromForm] string? itemType,
        [FromForm] Guid? itemId,
        [FromForm] bool keepEarlier,
        [FromForm] string? itemState,
        CancellationToken ct)
    {
        var files = (audio ?? []).Where(f => f.Length > 0).ToList();
        if (files.Any(f => f.Length > MaxAudioBytes) || files.Sum(f => f.Length) > MaxTotalBytes)
        {
            return BadRequest(new { errors = new[] { "The recording is too large (max 25 MB per part)." } });
        }
        if (files.Any(f => !CaptureService.IsSupportedAudioFile(f.FileName)))
        {
            return BadRequest(new { errors = new[] { "Unsupported audio format. Use m4a, mp3, wav, webm, ogg, flac or aac." } });
        }
        if (text?.Length > 10_000)
        {
            return BadRequest(new { errors = new[] { "The text is too long." } });
        }

        var streams = files.Select(f => f.OpenReadStream()).ToList();
        try
        {
            var segments = files.Select((f, i) => new AudioSegment(streams[i], f.FileName, f.ContentType)).ToList();
            var result = await _captures.ContinueAsync(id, new ContinueCaptureRequest(text, segments, itemType, itemId, keepEarlier, itemState), ct);
            if (result.Succeeded) return Ok(result.Value);
            return result.Errors.Contains("Capture not found.") ? NotFound(new { errors = result.Errors }) : BadRequest(new { errors = result.Errors });
        }
        finally
        {
            foreach (var s in streams) await s.DisposeAsync();
        }
    }

    /// <summary>POST /api/captures/{id}/confirm - save the accepted (possibly edited) items, reject the rest.</summary>
    [HttpPost("{id:guid}/confirm")]
    public async Task<ActionResult<CaptureDto>> Confirm(Guid id, ConfirmCaptureRequest request, CancellationToken ct)
    {
        var result = await _captures.ConfirmAsync(id, request, ct);
        if (result.Succeeded) return Ok(result.Value);
        return result.Errors.Contains("Capture not found.") ? NotFound(new { errors = result.Errors }) : BadRequest(new { errors = result.Errors });
    }

    /// <summary>GET /api/captures/{id}/audio?part=0 - the original recording (part N of CaptureDto.AudioParts).</summary>
    [HttpGet("{id:guid}/audio")]
    public async Task<IActionResult> GetAudio(Guid id, [FromQuery] int part = 0, CancellationToken ct = default)
    {
        var result = await _captures.OpenAudioAsync(id, part, ct);
        return result.Succeeded
            ? File(result.Value.Content, result.Value.MimeType, enableRangeProcessing: true)
            : NotFound(new { errors = result.Errors });
    }

    /// <summary>DELETE /api/captures/{id}/audio - delete the recording, keep the transcript.</summary>
    [HttpDelete("{id:guid}/audio")]
    public async Task<IActionResult> DeleteAudio(Guid id, CancellationToken ct)
    {
        var result = await _captures.DeleteAudioAsync(id, ct);
        return result.Succeeded ? NoContent() : NotFound(new { errors = result.Errors });
    }
}
