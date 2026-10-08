using AiPlanner.Application.Recurrence;
using AiPlanner.Application.Appointments.DTOs;
using AiPlanner.Application.Appointments.Interfaces;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Models;
using AiPlanner.Application.Common.Utils;
using AiPlanner.Application.Items.DTOs;
using AiPlanner.Application.Items.Interfaces;
using AiPlanner.Application.Notes.DTOs;
using AiPlanner.Application.Notes.Interfaces;
using AiPlanner.Application.Reminders;
using AiPlanner.Application.Tasks.DTOs;
using AiPlanner.Application.Tasks.Interfaces;
using AiPlanner.Domain.Common;
using AiPlanner.Domain.Entities;
using AiPlanner.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Items.Services;

/// <summary>
/// Any item can become any type (user's rule), after saving too. The new item
/// is created through the normal services (so the usual validation and
/// reminder rules apply) and the old one is soft-deleted, all in one
/// transaction. Carried over: title, details, notes, reminders, attachments, the source
/// capture, the date where both types have one (task due &lt;-&gt; event start),
/// and the creation time - it is the same item to the user, so "Created" and
/// the newest/oldest sorts keep placing it where it was.
/// </summary>
public class ItemConversionService : IItemConversionService
{
    private static readonly TimeSpan DefaultEventLength = TimeSpan.FromHours(1);
    private static readonly TimeOnly DefaultEventTime = new(9, 0);

    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTime _clock;
    private readonly ITaskService _tasks;
    private readonly IAppointmentService _appointments;
    private readonly INoteService _notes;
    private readonly ReminderPlanner _reminders;

    public ItemConversionService(
        IApplicationDbContext db, ICurrentUserService currentUser, IDateTime clock,
        ITaskService tasks, IAppointmentService appointments, INoteService notes, ReminderPlanner reminders)
    {
        _db = db;
        _currentUser = currentUser;
        _clock = clock;
        _tasks = tasks;
        _appointments = appointments;
        _notes = notes;
        _reminders = reminders;
    }

    public async Task<Result<ConvertedItemDto>> ConvertAsync(ConvertItemRequest request, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("No authenticated user.");
        var source = await LoadAsync(userId, request.FromType, request.Id, ct);
        if (source is null)
        {
            return Result<ConvertedItemDto>.Failure("Item not found.");
        }

        var zone = await _reminders.ZoneAsync(userId, ct);
        try
        {
            return await _db.ExecuteInTransactionAsync(async innerCt =>
            {
                var (created, needsDetails) = await CreateTargetAsync(request, source, zone, innerCt);
                if (!created.Succeeded)
                {
                    throw new ConversionException(string.Join(" ", created.Errors));
                }
                var newId = created.Value;

                // Keep when it was first created and the link to the capture it came
                // from, and repoint the capture's item.
                await CarryOverAsync(request.ToType, newId, source, innerCt);
                // Its photos and documents go with it.
                var attachments = await _db.Attachments
                    .Where(x => x.UserId == userId && x.ItemType == request.FromType && x.ItemId == request.Id)
                    .ToListAsync(innerCt);
                foreach (var attachment in attachments)
                {
                    attachment.ItemType = request.ToType;
                    attachment.ItemId = newId;
                }
                var captureItems = await _db.AIExtractionItems
                    .Where(i => i.ResultingTaskItemId == source.Id || i.ResultingAppointmentId == source.Id || i.ResultingNoteId == source.Id)
                    .ToListAsync(innerCt);
                foreach (var i in captureItems)
                {
                    i.ResultingTaskItemId = request.ToType == "Task" ? newId : null;
                    i.ResultingAppointmentId = request.ToType == "Appointment" ? newId : null;
                    i.ResultingNoteId = request.ToType == "Note" ? newId : null;
                }

                // Replace the old item.
                source.Delete();
                await _db.SaveChangesAsync(innerCt);
                return Result<ConvertedItemDto>.Success(new ConvertedItemDto(request.ToType, newId, needsDetails));
            }, ct);
        }
        catch (ConversionException ex)
        {
            return Result<ConvertedItemDto>.Failure(ex.Message);
        }
    }

    private async Task<(Result<Guid> Created, bool NeedsDetails)> CreateTargetAsync(
        ConvertItemRequest r, Source s, TimeZoneInfo zone, CancellationToken ct)
    {
        switch (r.ToType)
        {
            case "Task":
            {
                var due = r.DueUtc ?? s.WhenUtc;
                var hasTime = due is not null && (r.HasDueTime ?? (r.DueUtc is null ? s.HasTime : true));
                // A task has no location field: keep it in the details.
                var details = JoinText(s.Details, s.Location is null ? null : $"Location: {s.Location}");
                var created = await _tasks.CreateAsync(new CreateTaskRequest(
                    s.Title, details, s.Notes, StartDateUtc: null, due, hasTime, TaskPriority.None, IsOngoing: false,
                    Reminders(s, targetHasTime: due is not null && hasTime), Tags: s.Tags, Recurrence: due is null ? null : s.Recurrence), ct);
                return (created.Succeeded ? Result<Guid>.Success(created.Value!.Id) : Result<Guid>.Failure(created.Errors.ToArray()), false);
            }
            case "Appointment":
            {
                // An event needs a time: the one given, the item's own, or tomorrow 09:00 (then the user checks it).
                var start = r.StartUtc ?? (s.WhenUtc is { } w && s.HasTime ? w : (DateTime?)null);
                var guessed = start is null;
                start ??= s.WhenUtc is { } dateOnly
                    ? UserTimeZoneHelper.LocalToUtc(DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(dateOnly, zone)).ToDateTime(DefaultEventTime), zone)
                    : UserTimeZoneHelper.LocalToUtc(UserTimeZoneHelper.TodayInTimeZone(zone, _clock.UtcNow).AddDays(1).ToDateTime(DefaultEventTime), zone);
                var end = r.EndUtc ?? (s.EndUtc is { } e && e > start ? e : start.Value + DefaultEventLength);
                var created = await _appointments.CreateAsync(new CreateAppointmentRequest(
                    s.Title, s.Details, s.Notes, start.Value, end, s.Location, ParticipantNames: null,
                    Reminders(s, targetHasTime: true), s.Recurrence, s.Tags), ct);
                return (created.Succeeded ? Result<Guid>.Success(created.Value!.Id) : Result<Guid>.Failure(created.Errors.ToArray()), guessed);
            }
            default:
            {
                var content = JoinText(s.Details, s.Notes, s.Location is null ? null : $"Location: {s.Location}");
                var created = await _notes.CreateAsync(new SaveNoteRequest(
                    s.Title, content ?? s.Title, Reminders(s, targetHasTime: false), s.Tags), ct);
                return (created.Succeeded ? Result<Guid>.Success(created.Value!.Id) : Result<Guid>.Failure(created.Errors.ToArray()), false);
            }
        }
    }

    /// <summary>
    /// The item's reminders for the new type. "N minutes before" needs a time to
    /// count back from; without one it becomes a one-off at the moment it was
    /// due to go off (dropped if that's already past).
    /// </summary>
    private List<ReminderDto> Reminders(Source s, bool targetHasTime) =>
        s.Reminders
            .Select(r => r.Kind != ReminderKind.Before || targetHasTime
                ? r
                : r.NextAtUtc is { } at && at > _clock.UtcNow ? new ReminderDto(ReminderKind.At, AtUtc: at) : null)
            .OfType<ReminderDto>()
            .ToList();

    // ---- source items ----

    /// <summary>The fields every type can give, plus how to delete it.</summary>
    private sealed record Source(
        Guid Id, string Title, string? Details, string? Notes, DateTime? WhenUtc, bool HasTime, DateTime? EndUtc,
        string? Location, Guid? SourceCaptureId, DateTime CreatedAtUtc, IReadOnlyList<ReminderDto> Reminders, Action Delete,
        RecurrenceDto? Recurrence = null, IReadOnlyList<string>? Tags = null);

    private async Task<Source?> LoadAsync(Guid userId, string type, Guid id, CancellationToken ct)
    {
        switch (type)
        {
            case "Task":
            {
                var t = await _db.TaskItems.Include(x => x.Reminders).Include(x => x.RecurrenceRule).Include(x => x.TaskTags).ThenInclude(x => x.Tag).FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct);
                return t is null ? null : new Source(
                    t.Id, t.Title, t.Description, t.Notes, t.DueDateUtc, t.HasDueTime, null, null, t.SourceAiExtractionId, t.CreatedAtUtc,
                    ReminderPlanner.ToDtos(t.Reminders), () => { t.IsDeleted = true; ReminderPlanner.TurnOff(t.Reminders); },
                    RecurrencePlanner.ToDto(t.RecurrenceRule), t.TaskTags.Select(x => x.Tag.Name).ToList());
            }
            case "Appointment":
            {
                var a = await _db.Appointments.Include(x => x.Reminders).Include(x => x.RecurrenceRule).Include(x => x.AppointmentTags).ThenInclude(x => x.Tag).FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct);
                return a is null ? null : new Source(
                    a.Id, a.Title, a.Description, a.Notes, a.StartUtc, true, a.EndUtc, a.Location, a.SourceAiExtractionId, a.CreatedAtUtc,
                    ReminderPlanner.ToDtos(a.Reminders), () => { a.IsDeleted = true; ReminderPlanner.TurnOff(a.Reminders); },
                    RecurrencePlanner.ToDto(a.RecurrenceRule), a.AppointmentTags.Select(x => x.Tag.Name).ToList());
            }
            default:
            {
                var n = await _db.Notes.Include(x => x.Reminders).Include(x => x.NoteTags).ThenInclude(x => x.Tag).FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct);
                if (n is null) return null;
                // A note's title is optional; the text then gives the title.
                var title = n.Title ?? Shorten(n.Content);
                var details = n.Title is null && title == n.Content ? null : n.Content;
                return new Source(
                    n.Id, title, details, null, null, false, null, null, n.SourceAiExtractionId, n.CreatedAtUtc,
                    ReminderPlanner.ToDtos(n.Reminders), () => { n.IsDeleted = true; ReminderPlanner.TurnOff(n.Reminders); },
                    Tags: n.NoteTags.Select(x => x.Tag.Name).ToList());
            }
        }
    }

    /// <summary>
    /// The new item keeps the old one's creation time and source capture. Set
    /// after the create, so SaveChanges sees a modification (which only touches
    /// UpdatedAtUtc) rather than an insert (which stamps CreatedAtUtc).
    /// </summary>
    private async Task CarryOverAsync(string type, Guid id, Source source, CancellationToken ct)
    {
        BaseEntity created = type switch
        {
            "Task" => (await _db.TaskItems.FindAsync([id], ct))!,
            "Appointment" => (await _db.Appointments.FindAsync([id], ct))!,
            _ => (await _db.Notes.FindAsync([id], ct))!,
        };
        created.CreatedAtUtc = source.CreatedAtUtc;
        if (source.SourceCaptureId is { } captureId)
        {
            switch (created)
            {
                case TaskItem t: t.SourceAiExtractionId = captureId; break;
                case Appointment ap: ap.SourceAiExtractionId = captureId; break;
                case Note n: n.SourceAiExtractionId = captureId; break;
            }
        }
    }

    /// <summary>The non-empty parts as paragraphs, or null when there are none.</summary>
    private static string? JoinText(params string?[] parts)
    {
        var text = string.Join("\n\n", parts.Where(p => !string.IsNullOrWhiteSpace(p)));
        return text.Length > 0 ? text : null;
    }

    private static string Shorten(string text)
    {
        var flat = string.Join(' ', text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return flat.Length <= 80 ? flat : flat[..79].TrimEnd() + "…";
    }

    /// <summary>Aborts the conversion transaction with a message for the user.</summary>
    private sealed class ConversionException(string message) : Exception(message);
}
