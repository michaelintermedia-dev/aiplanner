using AiPlanner.Application.Notifications.DTOs;
using AiPlanner.Application.Settings.DTOs;
using AiPlanner.Application.Settings.Services;
using AiPlanner.Application.Notifications.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiPlanner.Api.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize]
public class SettingsController : ControllerBase
{
    private readonly INotificationService _notifications;

    public SettingsController(INotificationService notifications)
    {
        _notifications = notifications;
    }

    [HttpGet("notifications")]
    public async Task<ActionResult<NotificationSettingsDto>> GetNotifications(CancellationToken ct) =>
        Ok(await _notifications.GetSettingsAsync(ct));

    /// <summary>GET /api/settings/recordings - how voice recordings are saved.</summary>
    [HttpGet("recordings")]
    public async Task<ActionResult<RecordingSettingsDto>> GetRecordings([FromServices] RecordingSettingsService recordings, CancellationToken ct) =>
        Ok(await recordings.GetAsync(ct));

    /// <summary>PUT /api/settings/recordings</summary>
    [HttpPut("recordings")]
    public async Task<ActionResult<RecordingSettingsDto>> UpdateRecordings(RecordingSettingsDto settings, [FromServices] RecordingSettingsService recordings, CancellationToken ct) =>
        Ok(await recordings.UpdateAsync(settings, ct));

    /// <summary>GET /api/settings/calendar - where weeks begin.</summary>
    [HttpGet("calendar")]
    public async Task<ActionResult<CalendarSettingsDto>> GetCalendar([FromServices] CalendarSettingsService calendar, CancellationToken ct) =>
        Ok(await calendar.GetAsync(ct));

    /// <summary>PUT /api/settings/calendar</summary>
    [HttpPut("calendar")]
    public async Task<ActionResult<CalendarSettingsDto>> UpdateCalendar(CalendarSettingsDto settings, [FromServices] CalendarSettingsService calendar, CancellationToken ct) =>
        Ok(await calendar.UpdateAsync(settings, ct));

    /// <summary>GET /api/settings/appearance - light/dark and the colour scheme.</summary>
    [HttpGet("appearance")]
    public async Task<ActionResult<AppearanceSettingsDto>> GetAppearance([FromServices] AppearanceSettingsService appearance, CancellationToken ct) =>
        Ok(await appearance.GetAsync(ct));

    /// <summary>PUT /api/settings/appearance</summary>
    [HttpPut("appearance")]
    public async Task<ActionResult<AppearanceSettingsDto>> UpdateAppearance(AppearanceSettingsDto settings, [FromServices] AppearanceSettingsService appearance, CancellationToken ct) =>
        Ok(await appearance.UpdateAsync(settings, ct));

    /// <summary>PUT /api/settings/wallpaper - the user's own wallpaper photo (form field "file"); turns the wallpaper on.</summary>
    [HttpPut("wallpaper")]
    [RequestSizeLimit(AppearanceSettingsService.MaxPhotoBytes + 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = AppearanceSettingsService.MaxPhotoBytes + 1024 * 1024)]
    public async Task<ActionResult<AppearanceSettingsDto>> SetWallpaper(IFormFile? file, [FromServices] AppearanceSettingsService appearance, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest(new { errors = new[] { "Attach the picture as form field \"file\"." } });
        await using var stream = file.OpenReadStream();
        var result = await appearance.SetPhotoAsync(file.FileName, file.Length, stream, ct);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { errors = result.Errors });
    }

    /// <summary>DELETE /api/settings/wallpaper - back to the skin's wallpaper.</summary>
    [HttpDelete("wallpaper")]
    public async Task<ActionResult<AppearanceSettingsDto>> RemoveWallpaper([FromServices] AppearanceSettingsService appearance, CancellationToken ct) =>
        Ok(await appearance.RemovePhotoAsync(ct));

    /// <summary>GET /api/settings/wallpaper/{id} - the user's wallpaper photo (only their own; cacheable - a new photo gets a new id).</summary>
    [HttpGet("wallpaper/{id}")]
    public async Task<IActionResult> GetWallpaper(string id, [FromServices] AppearanceSettingsService appearance, CancellationToken ct)
    {
        var photo = await appearance.OpenPhotoAsync(id, ct);
        if (photo is null) return NotFound(new { errors = new[] { "No such wallpaper." } });
        Response.Headers.CacheControl = "private, max-age=31536000, immutable";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return File(photo.Value.Content, photo.Value.ContentType);
    }

    [HttpPut("notifications")]
    public async Task<ActionResult<NotificationSettingsDto>> UpdateNotifications(NotificationSettingsDto settings, CancellationToken ct) =>
        Ok(await _notifications.UpdateSettingsAsync(settings, ct));
}
