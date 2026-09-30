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
    /// <summary>OpenAI's upload limit for transcription.</summary>
    private const long MaxAudioBytes = 25 * 1024 * 1024;

    private readonly ICaptureService _captures;

    public CapturesController(ICaptureService captures)
    {
        _captures = captures;
    }

    /// <summary>GET /api/captures?take=50 - capture history, newest first.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CaptureSummaryDto>>> GetList([FromQuery] int take = 50, CancellationToken ct = default) =>
        Ok(await _captures.GetListAsync(take, ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CaptureDto>> GetById(Guid id, CancellationToken ct)
    {
        var result = await _captures.GetByIdAsync(id, ct);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { errors = result.Errors });
    }

    /// <summary>POST /api/captures/text - analyze typed text. Nothing is saved as a task/appointment yet.</summary>
    [HttpPost("text")]
    public async Task<ActionResult<CaptureDto>> CaptureText(CaptureTextRequest request, CancellationToken ct)
    {
        var result = await _captures.CaptureTextAsync(request, ct);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { errors = result.Errors });
    }

    /// <summary>POST /api/captures/voice (multipart/form-data, field "audio") - transcribe and analyze a recording.</summary>
    [HttpPost("voice")]
    [RequestSizeLimit(MaxAudioBytes + 64 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxAudioBytes + 64 * 1024)]
    public async Task<ActionResult<CaptureDto>> CaptureVoice(IFormFile? audio, CancellationToken ct)
    {
        if (audio is null || audio.Length == 0)
        {
            return BadRequest(new { errors = new[] { "Attach the recording as form field \"audio\"." } });
        }
        if (audio.Length > MaxAudioBytes)
        {
            return BadRequest(new { errors = new[] { "The recording is too large (max 25 MB)." } });
        }
        if (!CaptureService.IsSupportedAudioFile(audio.FileName))
        {
            return BadRequest(new { errors = new[] { "Unsupported audio format. Use m4a, mp3, wav, webm, ogg, flac or aac." } });
        }

        await using var stream = audio.OpenReadStream();
        var result = await _captures.CaptureVoiceAsync(stream, audio.FileName, audio.ContentType, ct);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { errors = result.Errors });
    }

    /// <summary>POST /api/captures/{id}/confirm - save the accepted (possibly edited) items, reject the rest.</summary>
    [HttpPost("{id:guid}/confirm")]
    public async Task<ActionResult<CaptureDto>> Confirm(Guid id, ConfirmCaptureRequest request, CancellationToken ct)
    {
        var result = await _captures.ConfirmAsync(id, request, ct);
        if (result.Succeeded) return Ok(result.Value);
        return result.Errors.Contains("Capture not found.") ? NotFound(new { errors = result.Errors }) : BadRequest(new { errors = result.Errors });
    }

    /// <summary>GET /api/captures/{id}/audio - the original recording.</summary>
    [HttpGet("{id:guid}/audio")]
    public async Task<IActionResult> GetAudio(Guid id, CancellationToken ct)
    {
        var result = await _captures.OpenAudioAsync(id, ct);
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
