using AiPlanner.Application.Recurrence;
using AiPlanner.Application.Appointments.DTOs;
using AiPlanner.Application.Appointments.Interfaces;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Models;
using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Entities;
using AiPlanner.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Appointments.Services;

public class AppointmentService : IAppointmentService
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTime _dateTime;
    private readonly ReminderPlanner _reminders;

    public AppointmentService(IApplicationDbContext db, ICurrentUserService currentUser, IDateTime dateTime, ReminderPlanner reminders)
    {
        _reminders = reminders;
        _db = db;
        _currentUser = currentUser;
        _dateTime = dateTime;
    }

    public async Task<IReadOnlyList<AppointmentDto>> GetListAsync(AppointmentQueryParameters query, CancellationToken ct = default)
    {
        var userId = RequireUserId();

        var q = _db.Appointments
            .AsNoTracking()
            .Include(a => a.Participants)
            .Include(a => a.RecurrenceRule)
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
        var zone = await _reminders.ZoneAsync(userId, ct);
        SetRecurrence(appointment, request.Recurrence, zone);
        SetReminders(appointment, request.Reminders, zone);

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

        // Re-set even if unchanged: a "before" reminder follows the start time.
        var zone = await _reminders.ZoneAsync(appointment.UserId, ct);
        SetRecurrence(appointment, request.Recurrence, zone);
        SetReminders(appointment, request.Reminders, zone);

        await _db.SaveChangesAsync(ct);
        return Result<AppointmentDto>.Success(ToDto(appointment));
    }

    public async Task<Result<AppointmentDto>> SkipOccurrenceAsync(Guid id, DateTime occurrenceStartUtc, bool skip, CancellationToken ct = default)
    {
        var appointment = await FindOwnedAsync(id, track: true, ct);
        if (appointment is null)
        {
            return Result<AppointmentDto>.Failure("Appointment not found.");
        }
        var zone = await _reminders.ZoneAsync(appointment.UserId, ct);
        var start = DateTime.SpecifyKind(occurrenceStartUtc, DateTimeKind.Utc);
        if (appointment.RecurrenceRule is null || !EventOccurrences.IsOccurrence(appointment, zone, start))
        {
            return Result<AppointmentDto>.Failure("That isn't one of this event's dates.");
        }
        // Assign a new list (not Add/Remove) so EF sees the JSON column change.
        appointment.SkippedOccurrencesUtc = skip
            ? [.. appointment.SkippedOccurrencesUtc.Where(s => s != start), start]
            : [.. appointment.SkippedOccurrencesUtc.Where(s => s != start)];
        // "Before" reminders follow the next occurrence that still happens.
        SetReminders(appointment, ReminderPlanner.ToDtos(appointment.Reminders), zone);
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

        appointment.StartUtc = request.NewStartUtc;
        appointment.EndUtc = request.NewEndUtc;
        if (appointment.Status == AppointmentStatus.Cancelled)
        {
            appointment.Status = AppointmentStatus.Scheduled;
        }

        // Same reminder, re-timed: a "before" one moves with the start.
        SetReminders(appointment, ReminderPlanner.ToDtos(appointment.Reminders), await _reminders.ZoneAsync(appointment.UserId, ct));

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
        ReminderPlanner.TurnOff(appointment.Reminders, pausedWithItem: true);

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
        ReminderPlanner.TurnOff(appointment.Reminders, pausedWithItem: true);

        await _db.SaveChangesAsync(ct);
        return Result<AppointmentDto>.Success(ToDto(appointment));
    }

    /// <summary>Completed/cancelled -> scheduled again, restoring its reminder if still ahead.</summary>
    public async Task<Result<AppointmentDto>> ReopenAsync(Guid id, CancellationToken ct = default)
    {
        var appointment = await FindOwnedAsync(id, track: true, ct);
        if (appointment is null)
        {
            return Result<AppointmentDto>.Failure("Appointment not found.");
        }
        if (appointment.Status == AppointmentStatus.Scheduled)
        {
            return Result<AppointmentDto>.Failure("Only completed or cancelled appointments can be reopened.");
        }

        appointment.Status = AppointmentStatus.Scheduled;
        var reopenZone = await _reminders.ZoneAsync(appointment.UserId, ct);
        _reminders.Restore(appointment.Reminders, ReminderTime(appointment, reopenZone), reopenZone, appointment.UserId, r => r.AppointmentId = appointment.Id);

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
        ReminderPlanner.TurnOff(appointment.Reminders);

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
            .Include(a => a.RecurrenceRule)
            .Where(a => a.Id == id && a.UserId == userId);

        if (!track)
        {
            q = q.AsNoTracking();
        }

        return await q.FirstOrDefaultAsync(ct);
    }

    // New participants/reminders are added explicitly: their Guid keys are set in
    // the constructor, so if attached only via a tracked appointment's navigation
    // EF would treat them as existing rows (UPDATE -> 409 on edit).

    private void ApplyParticipants(Appointment appointment, IReadOnlyList<string>? names)
    {
        if (names is null)
        {
            return;
        }

        foreach (var existing in appointment.Participants.ToList())
        {
            _db.AppointmentParticipants.Remove(existing);
        }
        appointment.Participants.Clear();
        foreach (var name in names.Select(n => n.Trim()).Where(n => n.Length > 0).Distinct())
        {
            var participant = new AppointmentParticipant { Appointment = appointment, AppointmentId = appointment.Id, Name = name };
            _db.AppointmentParticipants.Add(participant);
            appointment.Participants.Add(participant);
        }
    }



    /// <summary>
    /// "Before" reminders count back from the item's time - for a repeating event,
    /// its next occurrence (notifications expand every occurrence themselves).
    /// </summary>
    private void SetReminders(Appointment appointment, IReadOnlyList<ReminderDto>? reminders, TimeZoneInfo zone) =>
        _reminders.Set(appointment.Reminders, reminders, ReminderTime(appointment, zone), zone, appointment.UserId, r => r.AppointmentId = appointment.Id);

    private DateTime ReminderTime(Appointment a, TimeZoneInfo zone) =>
        a.RecurrenceRule is null ? a.StartUtc : EventOccurrences.Next(a, zone, _dateTime.UtcNow)?.Start ?? a.StartUtc;

    private void SetRecurrence(Appointment appointment, RecurrenceDto? spec, TimeZoneInfo zone)
    {
        appointment.RecurrenceRule = RecurrencePlanner.Apply(_db, appointment.RecurrenceRule, RecurrencePlanner.Pin(spec, appointment.StartUtc, zone), appointment.UserId);
        appointment.RecurrenceRuleId = appointment.RecurrenceRule?.Id;
        if (appointment.RecurrenceRule is null) appointment.SkippedOccurrencesUtc = [];
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
        a.UpdatedAtUtc,
        ReminderPlanner.ToDtos(a.Reminders),
        a.SourceAiExtractionId,
        RecurrencePlanner.ToDto(a.RecurrenceRule),
        a.RecurrenceRule is null ? null : a.SkippedOccurrencesUtc);
}
