using AiPlanner.Application.Notes.DTOs;
using AiPlanner.Application.Notes.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiPlanner.Api.Controllers;

[ApiController]
[Route("api/notes")]
[Authorize]
public class NotesController : ControllerBase
{
    private readonly INoteService _notes;

    public NotesController(INoteService notes)
    {
        _notes = notes;
    }

    /// <summary>GET /api/notes?search= - most recently changed first.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<NoteDto>>> GetList([FromQuery] string? search, CancellationToken ct) =>
        Ok(await _notes.GetListAsync(search, ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<NoteDto>> GetById(Guid id, CancellationToken ct)
    {
        var result = await _notes.GetByIdAsync(id, ct);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { errors = result.Errors });
    }

    [HttpPost]
    public async Task<ActionResult<NoteDto>> Create(SaveNoteRequest request, CancellationToken ct)
    {
        var result = await _notes.CreateAsync(request, ct);
        if (!result.Succeeded) return BadRequest(new { errors = result.Errors });
        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<NoteDto>> Update(Guid id, SaveNoteRequest request, CancellationToken ct)
    {
        var result = await _notes.UpdateAsync(id, request, ct);
        return result.Succeeded ? Ok(result.Value) : NotFound(new { errors = result.Errors });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await _notes.DeleteAsync(id, ct);
        return result.Succeeded ? NoContent() : NotFound(new { errors = result.Errors });
    }
}
