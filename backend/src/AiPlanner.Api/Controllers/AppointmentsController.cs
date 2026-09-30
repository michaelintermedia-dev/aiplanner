using AiPlanner.Application.Appointments.DTOs;
using AiPlanner.Application.Appointments.Interfaces;
using AiPlanner.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiPlanner.Api.Controllers;

[ApiController]
[Route("api/appointments")]
[Authorize]
public class AppointmentsController : ControllerBase
{
    private readonly IAppointmentService _appointmentService;

    public AppointmentsController(IAppointmentService appointmentService)
    {
        _appointmentService = appointmentService;
    }

    /// <summary>GET /api/appointments?from=&to=&status=</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AppointmentDto>>> GetList(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] AppointmentStatus? status,
        CancellationToken ct)
    {
        var query = new AppointmentQueryParameters(from, to, status);
        return Ok(await _appointmentService.GetListAsync(query, ct));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AppointmentDto>> GetById(Guid id, CancellationToken ct)
    {
        var result = await _appointmentService.GetByIdAsync(id, ct);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { errors = result.Errors });
    }

    [HttpPost]
    public async Task<ActionResult<AppointmentDto>> Create(CreateAppointmentRequest request, CancellationToken ct)
    {
        var result = await _appointmentService.CreateAsync(request, ct);
        if (!result.Succeeded) return BadRequest(new { errors = result.Errors });
        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<AppointmentDto>> Update(Guid id, UpdateAppointmentRequest request, CancellationToken ct)
    {
        var result = await _appointmentService.UpdateAsync(id, request, ct);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { errors = result.Errors });
    }

    /// <summary>Dedicated "move this appointment" action - spec section 11 ("must be easy to reschedule").</summary>
    [HttpPatch("{id:guid}/reschedule")]
    public async Task<ActionResult<AppointmentDto>> Reschedule(Guid id, RescheduleAppointmentRequest request, CancellationToken ct)
    {
        var result = await _appointmentService.RescheduleAsync(id, request, ct);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { errors = result.Errors });
    }

    [HttpPatch("{id:guid}/complete")]
    public async Task<ActionResult<AppointmentDto>> Complete(Guid id, CancellationToken ct)
    {
        var result = await _appointmentService.CompleteAsync(id, ct);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { errors = result.Errors });
    }

    [HttpPatch("{id:guid}/cancel")]
    public async Task<ActionResult<AppointmentDto>> Cancel(Guid id, CancellationToken ct)
    {
        var result = await _appointmentService.CancelAsync(id, ct);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { errors = result.Errors });
    }

    /// <summary>Completed/cancelled -> scheduled again (its reminder is restored if still ahead).</summary>
    [HttpPatch("{id:guid}/reopen")]
    public async Task<ActionResult<AppointmentDto>> Reopen(Guid id, CancellationToken ct)
    {
        var result = await _appointmentService.ReopenAsync(id, ct);
        if (result.Succeeded) return Ok(result.Value);
        return result.Errors.Contains("Appointment not found.")
            ? NotFound(new { errors = result.Errors })
            : BadRequest(new { errors = result.Errors });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await _appointmentService.DeleteAsync(id, ct);
        return result.Succeeded ? NoContent() : NotFound(new { errors = result.Errors });
    }
}
