using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Models;
using AiPlanner.Application.Items.DTOs;
using AiPlanner.Application.Items.Interfaces;
using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Items.Services;

/// <summary>
/// Deleting from the feed: one or many items of any type at once, all or
/// nothing. Deletes are soft (as everywhere), so they can be undone: the
/// reminders are paused with the item rather than switched off, and a restore
/// brings back the ones that can still go off - unless the item was completed
/// or cancelled, where they stay paused until it's reopened.
/// </summary>
public class ItemDeletionService : IItemDeletionService
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly ReminderPlanner _reminders;

    public ItemDeletionService(IApplicationDbContext db, ICurrentUserService currentUser, ReminderPlanner reminders)
    {
        _db = db;
        _currentUser = currentUser;
        _reminders = reminders;
    }

    public async Task<Result<ItemsResultDto>> DeleteAsync(ItemsRequest request, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var (taskIds, appointmentIds, noteIds) = Split(request);

        var tasks = await _db.TaskItems.Include(t => t.Reminders).Where(t => t.UserId == userId && taskIds.Contains(t.Id)).ToListAsync(ct);
        var appointments = await _db.Appointments.Include(a => a.Reminders).Where(a => a.UserId == userId && appointmentIds.Contains(a.Id)).ToListAsync(ct);
        var notes = await _db.Notes.Include(n => n.Reminders).Where(n => n.UserId == userId && noteIds.Contains(n.Id)).ToListAsync(ct);

        foreach (var t in tasks)
        {
            t.IsDeleted = true;
            ReminderPlanner.TurnOff(t.Reminders, pausedWithItem: true);
        }
        foreach (var a in appointments)
        {
            a.IsDeleted = true;
            ReminderPlanner.TurnOff(a.Reminders, pausedWithItem: true);
        }
        foreach (var n in notes)
        {
            n.IsDeleted = true;
            ReminderPlanner.TurnOff(n.Reminders, pausedWithItem: true);
        }

        await _db.SaveChangesAsync(ct); // one SaveChanges = one transaction
        return Result<ItemsResultDto>.Success(new ItemsResultDto(tasks.Count + appointments.Count + notes.Count));
    }

    public async Task<Result<ItemsResultDto>> RestoreAsync(ItemsRequest request, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var (taskIds, appointmentIds, noteIds) = Split(request);
        var zone = await _reminders.ZoneAsync(userId, ct);

        // Deleted rows are hidden by the soft-delete filter, so look past it (still only this user's).
        var tasks = await _db.TaskItems.IgnoreQueryFilters().Include(t => t.Reminders)
            .Where(t => t.UserId == userId && t.IsDeleted && taskIds.Contains(t.Id)).ToListAsync(ct);
        var appointments = await _db.Appointments.IgnoreQueryFilters().Include(a => a.Reminders)
            .Where(a => a.UserId == userId && a.IsDeleted && appointmentIds.Contains(a.Id)).ToListAsync(ct);
        var notes = await _db.Notes.IgnoreQueryFilters().Include(n => n.Reminders)
            .Where(n => n.UserId == userId && n.IsDeleted && noteIds.Contains(n.Id)).ToListAsync(ct);

        foreach (var t in tasks)
        {
            t.IsDeleted = false;
            if (t.Status is not (TaskItemStatus.Completed or TaskItemStatus.Cancelled))
            {
                _reminders.Restore(t.Reminders, t.HasDueTime ? t.DueDateUtc : null, zone, userId, r => r.TaskItemId = t.Id);
            }
        }
        foreach (var a in appointments)
        {
            a.IsDeleted = false;
            if (a.Status == AppointmentStatus.Scheduled)
            {
                _reminders.Restore(a.Reminders, a.StartUtc, zone, userId, r => r.AppointmentId = a.Id);
            }
        }
        foreach (var n in notes)
        {
            n.IsDeleted = false;
            _reminders.Restore(n.Reminders, null, zone, userId, r => r.NoteId = n.Id);
        }

        await _db.SaveChangesAsync(ct);
        return Result<ItemsResultDto>.Success(new ItemsResultDto(tasks.Count + appointments.Count + notes.Count));
    }

    private static (List<Guid> Tasks, List<Guid> Appointments, List<Guid> Notes) Split(ItemsRequest request) => (
        request.Items.Where(i => i.ItemType == "Task").Select(i => i.Id).Distinct().ToList(),
        request.Items.Where(i => i.ItemType == "Appointment").Select(i => i.Id).Distinct().ToList(),
        request.Items.Where(i => i.ItemType == "Note").Select(i => i.Id).Distinct().ToList());

    private Guid RequireUserId() =>
        _currentUser.UserId ?? throw new UnauthorizedAccessException("No authenticated user.");
}
