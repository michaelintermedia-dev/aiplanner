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
using AiPlanner.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Items.Services;

/// <summary>
/// Any item can become any type (user's rule), after saving too - and it stays
/// the SAME item (user's call, 2026-10-09: tasks, events and notes are one kind
/// of item, see ItemBase). Its row's Kind changes in place, its reminders, tags
/// and media are re-pointed, and then the target type's own service writes the
/// fields (so the usual validation and reminder rules apply) - one transaction.
/// Same id, same creation time, same capture link; nothing is copied.
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
        if (request.ToType == request.FromType)
        {
            return Result<ConvertedItemDto>.Success(new ConvertedItemDto(request.ToType, request.Id, false));
        }

        var zone = await _reminders.ZoneAsync(userId, ct);
        try
        {
            return await _db.ExecuteInTransactionAsync(async innerCt =>
            {
                var target = Target(request, source, zone);
                // Saved first, so the row is as EF last saw it before it changes underneath.
                await _db.SaveChangesAsync(innerCt);
                await ChangeKindAsync(request.FromType, request.ToType, source.Id, target, source, innerCt);
                // The loaded copies are the old type now: forget them (only these - a
                // capture being saved around this keeps its own tracked changes).
                _db.Detach(source.Loaded);

                var written = await WriteFieldsAsync(request.ToType, source.Id, target, source, innerCt);
                if (!written.Succeeded)
                {
                    throw new ConversionException(string.Join(" ", written.Errors));
                }

                // Its photos and documents, and the capture items that made it, now name the new type.
                foreach (var attachment in await _db.Attachments.Where(x => x.UserId == userId && x.ItemId == source.Id).ToListAsync(innerCt))
                {
                    attachment.ItemType = request.ToType;
                }
                var captureItems = await _db.AIExtractionItems
                    .Where(i => i.ResultingTaskItemId == source.Id || i.ResultingAppointmentId == source.Id || i.ResultingNoteId == source.Id)
                    .ToListAsync(innerCt);
                foreach (var i in captureItems)
                {
                    i.ResultingTaskItemId = request.ToType == "Task" ? source.Id : null;
                    i.ResultingAppointmentId = request.ToType == "Appointment" ? source.Id : null;
                    i.ResultingNoteId = request.ToType == "Note" ? source.Id : null;
                }
                await _db.SaveChangesAsync(innerCt);
                return Result<ConvertedItemDto>.Success(new ConvertedItemDto(request.ToType, source.Id, target.NeedsDetails));
            }, ct);
        }
        catch (ConversionException ex)
        {
            return Result<ConvertedItemDto>.Failure(ex.Message);
        }
    }

    /// <summary>What the item becomes: its date/time for the new type (an event needs a time slot).</summary>
    private sealed record Plan(DateTime? WhenUtc, bool HasTime, DateTime? EndUtc, bool NeedsDetails);

    private Plan Target(ConvertItemRequest r, Source s, TimeZoneInfo zone)
    {
        switch (r.ToType)
        {
            case "Task":
            {
                var due = r.DueUtc ?? s.WhenUtc;
                var hasTime = due is not null && (r.HasDueTime ?? (r.DueUtc is null ? s.HasTime : true));
                return new Plan(due, hasTime, null, false);
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
                return new Plan(start, true, end, guessed);
            }
            default:
                return new Plan(null, false, null, false);
        }
    }

    // The link columns per type, and the item's status in the new type's terms.
    private static readonly Dictionary<string, (ItemKind Kind, string ReminderColumn, string TagTable, string TagColumn)> Types = new()
    {
        ["Task"] = (ItemKind.Task, "TaskItemId", "TaskTags", "TaskItemId"),
        ["Appointment"] = (ItemKind.Event, "AppointmentId", "AppointmentTags", "AppointmentId"),
        ["Note"] = (ItemKind.Note, "NoteId", "NoteTags", "NoteId"),
    };

    /// <summary>
    /// The row becomes the new type: its Kind, a status that type knows, the
    /// date columns it needs (an event can't be loaded without a start), and
    /// its reminders, tags and snoozes moved to the new type's link columns.
    /// </summary>
    private async Task ChangeKindAsync(string from, string to, Guid id, Plan target, Source s, CancellationToken ct)
    {
        var (kind, reminderColumn, tagTable, tagColumn) = Types[to];
        var (_, fromReminderColumn, fromTagTable, fromTagColumn) = Types[from];
        int? status = to switch
        {
            "Task" => s.Done ? (int)TaskItemStatus.Completed : s.Cancelled ? (int)TaskItemStatus.Cancelled : (int)TaskItemStatus.Inbox,
            "Appointment" => s.Done ? (int)AppointmentStatus.Completed : s.Cancelled ? (int)AppointmentStatus.Cancelled : (int)AppointmentStatus.Scheduled,
            _ => null,
        };
        bool? hasTime = to == "Task" ? target.HasTime : null;
        await _db.ExecuteSqlAsync(
            $"""
            UPDATE "Items" SET "Kind" = {(int)kind}, "Status" = {status}, "DateUtc" = {target.WhenUtc}, "HasTime" = {hasTime},
                "EndUtc" = {target.EndUtc}, "Title" = COALESCE("Title", {s.Title})
            WHERE "Id" = {id}
            """, ct);
        // Column names can't be parameters: they come from the fixed table above.
        await _db.ExecuteSqlAsync(FormattableStringFactory(
            $"UPDATE \"Reminders\" SET \"{fromReminderColumn}\" = NULL, \"{reminderColumn}\" = {{0}} WHERE \"{fromReminderColumn}\" = {{0}}", id), ct);
        await _db.ExecuteSqlAsync(FormattableStringFactory(
            $"UPDATE \"Notifications\" SET \"{fromReminderColumn}\" = NULL, \"{reminderColumn}\" = {{0}} WHERE \"{fromReminderColumn}\" = {{0}}", id), ct);
        await _db.ExecuteSqlAsync(FormattableStringFactory(
            $"INSERT INTO \"{tagTable}\" (\"{tagColumn}\", \"TagId\") SELECT \"{fromTagColumn}\", \"TagId\" FROM \"{fromTagTable}\" WHERE \"{fromTagColumn}\" = {{0}} ON CONFLICT DO NOTHING", id), ct);
        await _db.ExecuteSqlAsync(FormattableStringFactory($"DELETE FROM \"{fromTagTable}\" WHERE \"{fromTagColumn}\" = {{0}}", id), ct);
        if (from == "Appointment")
        {
            // People are carried in the new type's own field (written next).
            await _db.ExecuteSqlAsync($"""DELETE FROM "AppointmentParticipants" WHERE "AppointmentId" = {id}""", ct);
        }
    }

    private static FormattableString FormattableStringFactory(string format, params object?[] args) =>
        System.Runtime.CompilerServices.FormattableStringFactory.Create(format, args);

    /// <summary>The new type's service writes every field, as an ordinary edit would.</summary>
    private async Task<Result> WriteFieldsAsync(string to, Guid id, Plan target, Source s, CancellationToken ct)
    {
        switch (to)
        {
            case "Task":
            {
                var due = target.WhenUtc;
                var updated = await _tasks.UpdateAsync(id, new UpdateTaskRequest(
                    s.Title, s.Details, s.Notes, StartDateUtc: null, due, target.HasTime, s.Priority, IsOngoing: false,
                    Reminders(s, targetHasTime: due is not null && target.HasTime), s.Tags, due is null ? null : s.Recurrence,
                    s.Location ?? "", s.People ?? []), ct);
                return updated.Succeeded ? Result.Success() : Result.Failure(updated.Errors.ToArray());
            }
            case "Appointment":
            {
                var updated = await _appointments.UpdateAsync(id, new UpdateAppointmentRequest(
                    s.Title, s.Details, s.Notes, target.WhenUtc!.Value, target.EndUtc!.Value, s.Location, s.People ?? [],
                    Reminders(s, targetHasTime: true), s.Recurrence, s.Tags, s.Priority), ct);
                return updated.Succeeded ? Result.Success() : Result.Failure(updated.Errors.ToArray());
            }
            default:
            {
                var content = JoinText(s.Details, s.Notes);
                var updated = await _notes.UpdateAsync(id, new SaveNoteRequest(
                    s.NoteTitle, content ?? s.Title, Reminders(s, targetHasTime: false), s.Tags, s.Priority, s.Location ?? "", s.People ?? []), ct);
                return updated.Succeeded ? Result.Success() : Result.Failure(updated.Errors.ToArray());
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

    /// <summary>The fields every type can give, and the loaded entities (stale once the row changes type).</summary>
    private sealed record Source(
        Guid Id, string Title, string? NoteTitle, string? Details, string? Notes, DateTime? WhenUtc, bool HasTime, DateTime? EndUtc,
        string? Location, IReadOnlyList<ReminderDto> Reminders, IReadOnlyList<object> Loaded,
        RecurrenceDto? Recurrence = null, IReadOnlyList<string>? Tags = null,
        TaskPriority Priority = TaskPriority.None, IReadOnlyList<string>? People = null, bool Done = false, bool Cancelled = false);

    private async Task<Source?> LoadAsync(Guid userId, string type, Guid id, CancellationToken ct)
    {
        switch (type)
        {
            case "Task":
            {
                var t = await _db.TaskItems.Include(x => x.Reminders).Include(x => x.RecurrenceRule).Include(x => x.TaskTags).ThenInclude(x => x.Tag).FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct);
                return t is null ? null : new Source(
                    t.Id, t.Title, t.Title, t.Description, t.Notes, t.DueDateUtc, t.HasDueTime, null, t.Location,
                    ReminderPlanner.ToDtos(t.Reminders), [t, .. t.Reminders, .. t.TaskTags],
                    RecurrencePlanner.ToDto(t.RecurrenceRule), t.TaskTags.Select(x => x.Tag.Name).ToList(), t.Priority, t.People,
                    t.Status == TaskItemStatus.Completed, t.Status == TaskItemStatus.Cancelled);
            }
            case "Appointment":
            {
                var a = await _db.Appointments.Include(x => x.Reminders).Include(x => x.RecurrenceRule).Include(x => x.Participants).Include(x => x.AppointmentTags).ThenInclude(x => x.Tag).FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct);
                return a is null ? null : new Source(
                    a.Id, a.Title, a.Title, a.Description, a.Notes, a.StartUtc, true, a.EndUtc, a.Location,
                    ReminderPlanner.ToDtos(a.Reminders), [a, .. a.Reminders, .. a.AppointmentTags, .. a.Participants],
                    RecurrencePlanner.ToDto(a.RecurrenceRule), a.AppointmentTags.Select(x => x.Tag.Name).ToList(), a.Priority,
                    a.Participants.Select(p => p.Name).ToList(),
                    a.Status == AppointmentStatus.Completed, a.Status == AppointmentStatus.Cancelled);
            }
            default:
            {
                var n = await _db.Notes.Include(x => x.Reminders).Include(x => x.NoteTags).ThenInclude(x => x.Tag).FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct);
                if (n is null) return null;
                // A note's title is optional; the text then gives the title.
                var title = n.Title ?? Shorten(n.Content);
                var details = n.Title is null && title == n.Content ? null : n.Content;
                return new Source(
                    n.Id, title, n.Title, details, null, null, false, null, n.Location,
                    ReminderPlanner.ToDtos(n.Reminders), [n, .. n.Reminders, .. n.NoteTags],
                    Tags: n.NoteTags.Select(x => x.Tag.Name).ToList(), Priority: n.Priority, People: n.People);
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
