using AiPlanner.Application.Tasks.DTOs;
using AiPlanner.Application.Tasks.Interfaces;
using AiPlanner.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiPlanner.Api.Controllers;

[ApiController]
[Route("api/tasks")]
[Authorize]
public class TasksController : ControllerBase
{
    private readonly ITaskService _taskService;

    public TasksController(ITaskService taskService)
    {
        _taskService = taskService;
    }

    /// <summary>
    /// GET /api/tasks?status=&priority=&tag=&dueFrom=&dueTo=&includeCompleted=
    /// By default excludes Completed/Cancelled unless status or includeCompleted is given.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TaskItemDto>>> GetList(
        [FromQuery] TaskItemStatus? status,
        [FromQuery] TaskPriority? priority,
        [FromQuery] string? tag,
        [FromQuery] DateTime? dueFrom,
        [FromQuery] DateTime? dueTo,
        [FromQuery] bool includeCompleted,
        CancellationToken ct)
    {
        var query = new TaskQueryParameters(status, priority, tag, dueFrom, dueTo, includeCompleted);
        return Ok(await _taskService.GetListAsync(query, ct));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TaskItemDto>> GetById(Guid id, CancellationToken ct)
    {
        var result = await _taskService.GetByIdAsync(id, ct);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { errors = result.Errors });
    }

    [HttpPost]
    public async Task<ActionResult<TaskItemDto>> Create(CreateTaskRequest request, CancellationToken ct)
    {
        var result = await _taskService.CreateAsync(request, ct);
        if (!result.Succeeded) return BadRequest(new { errors = result.Errors });
        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TaskItemDto>> Update(Guid id, UpdateTaskRequest request, CancellationToken ct)
    {
        var result = await _taskService.UpdateAsync(id, request, ct);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { errors = result.Errors });
    }

    [HttpPatch("{id:guid}/complete")]
    public async Task<ActionResult<TaskItemDto>> Complete(Guid id, CancellationToken ct)
    {
        var result = await _taskService.CompleteAsync(id, ct);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { errors = result.Errors });
    }

    [HttpPatch("{id:guid}/cancel")]
    public async Task<ActionResult<TaskItemDto>> Cancel(Guid id, CancellationToken ct)
    {
        var result = await _taskService.CancelAsync(id, ct);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { errors = result.Errors });
    }

    [HttpPatch("{id:guid}/reopen")]
    public async Task<ActionResult<TaskItemDto>> Reopen(Guid id, CancellationToken ct)
    {
        var result = await _taskService.ReopenAsync(id, ct);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { errors = result.Errors });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await _taskService.DeleteAsync(id, ct);
        return result.Succeeded ? NoContent() : NotFound(new { errors = result.Errors });
    }
}
