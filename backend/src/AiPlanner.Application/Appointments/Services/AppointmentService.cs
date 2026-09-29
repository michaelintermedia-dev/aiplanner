using AiPlanner.Application.Appointments.DTOs;
using AiPlanner.Application.Appointments.Interfaces;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Models;
using AiPlanner.Domain.Entities;
using AiPlanner.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Appointments.Services;

public class AppointmentService : IAppointmentService
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public AppointmentService(IApplicationDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<AppointmentDto>> GetListAsync(AppointmentQueryParameters query, CancellationToken ct = default)
    {
        var userId = RequireUserId();

        var q = _db.Appointments
            .AsNoTracking()
            .Include(a => a.Participants)
            .Where(a => a.UserId == userId);

        if (query.FromUtc.HasValue)
        {
            q = q.Where(a => a.EndUtc >= query.FromUtc.Value);
        }

        if (query.ToUtc.HasValue)
        {
            q = q.Where(a => a.StartUtc < query.ToUtc.Value);
        }

        if (query.Status.HasValue)
        {
            q = q.Where(a => a.Status == query.Status.Value);
        }

        var items = await q.OrderBy(a => a.StartUtc).ToListAsync(ct);
        return items.Select(ToDto).ToList();
    }

    public async Task<Result<AppointmentDto>> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var appointment = await FindOwnedAsync(id, track: false, ct);
        return appointment is null
            ? Result<AppointmentDto>.Failure("Appointment not found.")
            : Result<AppointmentDto>.Success(ToDto(appointment));
    }

    public async Task<Result<AppointmentDto>> CreateAsync(CreateAppointmentRequest request, CancellationToken ct = default)
    {
        var userId = RequireUserId();

        var appointment = new Appointment
        {
            UserId = userId,
            Title = request.Title.Trim(),
            Description = request.Description,
            Notes = request.Notes,
            StartUtc = request.StartUtc,
            EndUtc = request.EndUtc,
            Location = request.Location,
            Status = AppointmentStatus.Scheduled
        };

        ApplyParticipants(appointment, request.ParticipantNames);
        ApplyReminder(appointment, request.ReminderMinutesBeforeStart);

        _db.Appointments.Add(appointment);
        await _db.SaveChangesAsync(ct);

        return Result<AppointmentDto>.Success(ToDto(appointment));
    }

    public async Task<Result<AppointmentDto>> UpdateAsync(Guid id, UpdateAppointmentRequest request, CancellationToken ct = default)
    {
        var appointment = await FindOwnedAsync(id, track: true, ct);
        if (appointment is null)
        {
            return Result<AppointmentDto>.Failure("Appointment not found.");
        }

        appointment.Title = request.Title.Trim();
        appointment.Description = request.Description;
        appointment.Notes = request.Notes;
        appointment.StartUtc = request.StartUtc;
        appointment.EndUtc = request.EndUtc;
        appointment.Location = request.Location;

        ApplyParticipants(appointment, request.ParticipantNames);

        CancelPendingReminders(appointment);
        ApplyReminder(appointment, request.ReminderMinutesBeforeStart);

        await _db.SaveChangesAsync(ct);
        return Result<AppointmentDto>.Success(ToDto(appointment));
    }

    public async Task<Result<AppointmentDto>> RescheduleAsync(Guid id, RescheduleAppointmentRequest request, CancellationToken ct = default)
    {
        var appointment = await FindOwnedAsync(id, track: true, ct);
        if (appointment is null)
        {
            return Result<AppointmentDto>.Failure("Appointment not found.");
        }

        // Preserve the gap between "reminder trigger" and "start" across the move.
        var reminderOffsets = appointment.Reminders
            .Where(r => !r.IsCancelled)
            .Select(r => appointment.StartUtc - r.TriggerAtUtc)
            .ToList();

        appointment.StartUtc = request.NewStartUtc;
        appointment.EndUtc = request.NewEndUtc;
        if (appointment.Status == AppointmentStatus.Cancelled)
        {
            appointment.Status = AppointmentStatus.Scheduled;
        }

        CancelPendingReminders(appointment);
        foreach (var offset in reminderOffsets)
        {
            _db.Reminders.Add(new Reminder
            {
                UserId = appointment.UserId,
                AppointmentId = appointment.Id,
                TriggerAtUtc = appointment.StartUtc - offset
            });
        }

        await _db.SaveChangesAsync(ct);
        return Result<AppointmentDto>.Success(ToDto(appointment));
    }

    public async Task<Result<AppointmentDto>> CompleteAsync(Guid id, CancellationToken ct = default)
    {
        var appointment = await FindOwnedAsync(id, track: true, ct);
        if (appointment is null)
        {
            return Result<AppointmentDto>.Failure("Appointment not found.");
        }

        appointment.Status = AppointmentStatus.Completed;
        CancelPendingReminders(appointment);

        await _db.SaveChangesAsync(ct);
        return Result<AppointmentDto>.Success(ToDto(appointment));
    }

    public async Task<Result<AppointmentDto>> CancelAsync(Guid id, CancellationToken ct = default)
    {
        var appointment = await FindOwnedAsync(id, track: true, ct);
        if (appointment is null)
        {
            return Result<AppointmentDto>.Failure("Appointment not found.");
        }

        appointment.Status = AppointmentStatus.Cancelled;
        CancelPendingReminders(appointment);

        await _db.SaveChangesAsync(ct);
        return Result<AppointmentDto>.Success(ToDto(appointment));
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var appointment = await FindOwnedAsync(id, track: true, ct);
        if (appointment is null)
        {
            return Result.Failure("Appointment not found.");
        }

        appointment.IsDeleted = true;
        CancelPendingReminders(appointment);

        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }

    // ---- helpers -------------------------------------------------------

    private Guid RequireUserId() =>
        _currentUser.UserId ?? throw new UnauthorizedAccessException("No authenticated user.");

    private async Task<Appointment?> FindOwnedAsync(Guid id, bool track, CancellationToken ct)
    {
        var userId = RequireUserId();

        var q = _db.Appointments
            .Include(a => a.Participants)
            .Include(a => a.Reminders)
            .Where(a => a.Id == id && a.UserId == userId);

        if (!track)
        {
            q = q.AsNoTracking();
        }

        return await q.FirstOrDefaultAsync(ct);
    }

    private static void ApplyParticipants(Appointment appointment, IReadOnlyList<string>? names)
    {
        if (names is null)
        {
            return;
        }

        appointment.Participants.Clear();
        foreach (var name in names.Select(n => n.Trim()).Where(n => n.Length > 0).Distinct())
        {
            appointment.Participants.Add(new AppointmentParticipant { Appointment = appointment, Name = name });
        }
    }

    private static void ApplyReminder(Appointment appointment, int? reminderMinutesBeforeStart)
    {
        if (reminderMinutesBeforeStart is null)
        {
            return;
        }

        var reminder = new Reminder
        {
            UserId = appointment.UserId,
            AppointmentId = appointment.Id,
            TriggerAtUtc = appointment.StartUtc.AddMinutes(-reminderMinutesBeforeStart.Value)
        };

        appointment.Reminders.Add(reminder);
    }

    private static void CancelPendingReminders(Appointment appointment)
    {
        foreach (var reminder in appointment.Reminders.Where(r => !r.IsCancelled))
        {
            reminder.IsCancelled = true;
        }
    }

    private static AppointmentDto ToDto(Appointment a) => new(
        a.Id,
        a.Title,
        a.Description,
        a.Notes,
        a.AiSummary,
        a.StartUtc,
        a.EndUtc,
        a.Location,
        a.Status,
        a.Participants.Select(p => new AppointmentParticipantDto(p.Name, p.Email)).ToList(),
        a.CreatedAtUtc,
        a.UpdatedAtUtc);
}
