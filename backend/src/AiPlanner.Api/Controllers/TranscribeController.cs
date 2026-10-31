using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Captures.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AiPlanner.Api.Controllers;

/// <summary>
/// The search box's mic (spec v2, 2026-10-31): speech to text only - no AI
/// reading, nothing stored. The words go into the search box.
/// </summary>
[ApiController]
[Route("api/transcribe")]
[Authorize]
public class TranscribeController : ControllerBase
{
    private const long MaxBytes = 10 * 1024 * 1024;
    private readonly ITranscriptionService _transcription;

    public TranscribeController(ITranscriptionService transcription)
    {
        _transcription = transcription;
    }

    /// <summary>POST /api/transcribe (multipart) - "audio" field(s) in speaking order -> { text }.</summary>
    [HttpPost]
    [EnableRateLimiting("ai")] // costs OpenAI calls (metered by the transcription service)
    [RequestSizeLimit(MaxBytes + 64 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxBytes + 32 * 1024)]
    public async Task<ActionResult<TranscribeResponse>> Post([FromForm] List<IFormFile> audio, CancellationToken ct)
    {
        var files = audio.Where(f => f.Length > 0).ToList();
        if (files.Count == 0) return BadRequest(new { errors = new[] { "Attach the recording as form field \"audio\"." } });
        if (files.Count > CaptureService.MaxSegments || files.Sum(f => f.Length) > MaxBytes)
            return BadRequest(new { errors = new[] { "The recording is too long for a search." } });
        if (files.Any(f => !CaptureService.IsSupportedAudioFile(f.FileName)))
            return BadRequest(new { errors = new[] { "Unsupported audio format. Use m4a, mp3, wav, webm, ogg, flac or aac." } });

        var parts = new List<string>();
        foreach (var file in files)
        {
            await using var stream = file.OpenReadStream();
            var result = await _transcription.TranscribeAsync(stream, file.FileName, file.ContentType, ct);
            if (!string.IsNullOrWhiteSpace(result.Text)) parts.Add(result.Text.Trim());
        }
        return Ok(new TranscribeResponse(string.Join(' ', parts)));
    }
}

public record TranscribeResponse(string Text);
