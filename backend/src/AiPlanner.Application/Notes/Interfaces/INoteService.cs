using AiPlanner.Application.Common.Models;
using AiPlanner.Application.Notes.DTOs;

namespace AiPlanner.Application.Notes.Interfaces;

public interface INoteService
{
    /// <summary>Most recently changed first; <paramref name="search"/> matches title or content.</summary>
    Task<IReadOnlyList<NoteDto>> GetListAsync(string? search, CancellationToken ct = default);
    Task<Result<NoteDto>> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Result<NoteDto>> CreateAsync(SaveNoteRequest request, CancellationToken ct = default);
    Task<Result<NoteDto>> UpdateAsync(Guid id, SaveNoteRequest request, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
}
