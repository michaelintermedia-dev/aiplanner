using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Models;
using AiPlanner.Application.Notes.DTOs;
using AiPlanner.Application.Notes.Interfaces;
using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Notes.Services;

/// <summary>Notes, scoped to the current user like everything else (spec section 8).</summary>
public class NoteService : INoteService
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly ReminderPlanner _reminders;

    public NoteService(IApplicationDbContext db, ICurrentUserService currentUser, ReminderPlanner reminders)
    {
        _db = db;
        _currentUser = currentUser;
        _reminders = reminders;
    }

    public async Task<IReadOnlyList<NoteDto>> GetListAsync(string? search, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var q = _db.Notes.AsNoTracking().Include(n => n.Reminders).Where(n => n.UserId == userId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            q = q.Where(n => (n.Title != null && n.Title.Contains(term)) || n.Content.Contains(term));
        }

        var notes = await q.OrderByDescending(n => n.UpdatedAtUtc).Take(200).ToListAsync(ct);
        return notes.Select(ToDto).ToList();
    }

    public async Task<Result<NoteDto>> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var note = await FindOwnedAsync(id, track: false, ct);
        return note is null ? Result<NoteDto>.Failure("Note not found.") : Result<NoteDto>.Success(ToDto(note));
    }

    public async Task<Result<NoteDto>> CreateAsync(SaveNoteRequest request, CancellationToken ct = default)
    {
        var note = new Note
        {
            UserId = RequireUserId(),
            Title = string.IsNullOrWhiteSpace(request.Title) ? null : request.Title.Trim(),
            Content = request.Content.Trim(),
        };
        _db.Notes.Add(note);
        await SetRemindersAsync(note, request.Reminders, ct);
        await _db.SaveChangesAsync(ct);
        return Result<NoteDto>.Success(ToDto(note));
    }

    public async Task<Result<NoteDto>> UpdateAsync(Guid id, SaveNoteRequest request, CancellationToken ct = default)
    {
        var note = await FindOwnedAsync(id, track: true, ct);
        if (note is null)
        {
            return Result<NoteDto>.Failure("Note not found.");
        }

        note.Title = string.IsNullOrWhiteSpace(request.Title) ? null : request.Title.Trim();
        note.Content = request.Content.Trim();
        await SetRemindersAsync(note, request.Reminders, ct);
        await _db.SaveChangesAsync(ct);
        return Result<NoteDto>.Success(ToDto(note));
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var note = await FindOwnedAsync(id, track: true, ct);
        if (note is null)
        {
            return Result.Failure("Note not found.");
        }

        note.IsDeleted = true; // soft delete, like everything else (sync needs it)
        ReminderPlanner.TurnOff(note.Reminders);
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }

    private async Task<Note?> FindOwnedAsync(Guid id, bool track, CancellationToken ct)
    {
        var userId = RequireUserId();
        var q = _db.Notes.Include(n => n.Reminders).Where(n => n.Id == id && n.UserId == userId);
        return await (track ? q : q.AsNoTracking()).FirstOrDefaultAsync(ct);
    }

    private async Task SetRemindersAsync(Note note, IReadOnlyList<ReminderDto>? reminders, CancellationToken ct) =>
        _reminders.Set(note.Reminders, reminders, itemTimeUtc: null, await _reminders.ZoneAsync(note.UserId, ct), note.UserId, r => r.NoteId = note.Id);

    private Guid RequireUserId() =>
        _currentUser.UserId ?? throw new UnauthorizedAccessException("No authenticated user.");

    private static NoteDto ToDto(Note n) =>
        new(n.Id, n.Title, n.Content, n.AiSummary, n.SourceAiExtractionId, ReminderPlanner.ToDtos(n.Reminders), n.CreatedAtUtc, n.UpdatedAtUtc);
}
