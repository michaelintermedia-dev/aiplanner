using AiPlanner.Application.Common.Utils;
using AiPlanner.Application.Recurrence;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Tags;
using AiPlanner.Application.Common.Models;
using AiPlanner.Application.Reminders;
using AiPlanner.Application.Tasks.DTOs;
using AiPlanner.Application.Tasks.Interfaces;
using AiPlanner.Domain.Entities;
using AiPlanner.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Tasks.Services;

/// <summary>
/// CRUD + lifecycle transitions for TaskItem, always scoped to the current user
/// (spec section 8 - no cross-user access). Reminders go through
/// ReminderPlanner; actual notification delivery is Phase 4.
/// </summary>
public class TaskService : ITaskService
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTime _dateTime;
    private readonly ReminderPlanner _reminders;

    public TaskService(IApplicationDbContext db, ICurrentUserService currentUser, IDateTime dateTime, ReminderPlanner reminders)
    {
        _db = db;
        _currentUser = currentUser;
        _dateTime = dateTime;
        _reminders = reminders;
    }

    public async Task<IReadOnlyList<TaskItemDto>> GetListAsync(TaskQueryParameters query, CancellationToken ct = default)
    {
        var userId = RequireUserId();

        var q = _db.TaskItems
            .AsNoTracking()
            .Include(t => t.TaskTags).ThenInclude(tt => tt.Tag)
            .Include(t => t.RecurrenceRule)
            .Where(t => t.UserId == userId);

        if (query.Status.HasValue)
        {
            q = q.Where(t => t.Status == query.Status.Value);
        }
        else if (!query.IncludeCompleted)
        {
            q = q.Where(t => t.Status != TaskItemStatus.Completed && t.Status != TaskItemStatus.Cancelled);
        }

        if (query.Priority.HasValue)
        {
            q = q.Where(t => t.Priority == query.Priority.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Tag))
        {
            q = q.Where(t => t.TaskTags.Any(tt => tt.Tag.Name == query.Tag));
        }

        if (query.DueFromUtc.HasValue)
        {
            q = q.Where(t => t.DueDateUtc != null && t.DueDateUtc >= query.DueFromUtc.Value);
        }

        if (query.DueToUtc.HasValue)
        {
            q = q.Where(t => t.DueDateUtc != null && t.DueDateUtc < query.DueToUtc.Value);
        }

        var items = await q
            .OrderBy(t => t.DueDateUtc == null)
            .ThenBy(t => t.DueDateUtc)
            .ThenByDescending(t => t.Priority)
            .ToListAsync(ct);

        return items.Select(ToDto).ToList();
    }

    public async Task<Result<TaskItemDto>> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var task = await FindOwnedAsync(id, track: false, ct);
        return task is null
            ? Result<TaskItemDto>.Failure("Task not found.")
            : Result<TaskItemDto>.Success(ToDto(task));
    }

    public async Task<Result<TaskItemDto>> CreateAsync(CreateTaskRequest request, CancellationToken ct = default)
    {
        var userId = RequireUserId();

        var task = new TaskItem
        {
            UserId = userId,
            Title = request.Title.Trim(),
            Description = request.Description,
            Notes = request.Notes,
            StartDateUtc = request.StartDateUtc,
            DueDateUtc = request.DueDateUtc,
            HasDueTime = request.HasDueTime,
            Priority = request.Priority,
            Status = DetermineInitialStatus(request.IsOngoing, request.DueDateUtc)
        };

        await ApplyTagsAsync(task, request.Tags, ct);

        var zone = await _reminders.ZoneAsync(userId, ct);
        SetReminders(task, request.Reminders, zone);
        SetRecurrence(task, request.Recurrence, zone);

        _db.TaskItems.Add(task);
        await _db.SaveChangesAsync(ct);

        return Result<TaskItemDto>.Success(ToDto(task));
    }

    public async Task<Result<TaskItemDto>> UpdateAsync(Guid id, UpdateTaskRequest request, CancellationToken ct = default)
    {
        var task = await FindOwnedAsync(id, track: true, ct);
        if (task is null)
        {
            return Result<TaskItemDto>.Failure("Task not found.");
        }

        task.Title = request.Title.Trim();
        task.Description = request.Description;
        task.Notes = request.Notes;
        task.StartDateUtc = request.StartDateUtc;
        task.DueDateUtc = request.DueDateUtc;
        task.HasDueTime = request.HasDueTime;
        task.Priority = request.Priority;

        // Only move between the "open" statuses here; Complete/Cancel/Reopen
        // are explicit actions so a plain field edit can never silently
        // resurrect a cancelled task or un-complete a finished one.
        if (task.Status != TaskItemStatus.Completed && task.Status != TaskItemStatus.Cancelled)
        {
            task.Status = DetermineInitialStatus(request.IsOngoing, request.DueDateUtc);
        }

        await ApplyTagsAsync(task, request.Tags, ct);

        // Re-set even if unchanged: a "before" reminder follows the due date.
        var zone = await _reminders.ZoneAsync(task.UserId, ct);
        SetReminders(task, request.Reminders, zone);
        SetRecurrence(task, request.Recurrence, zone);

        await _db.SaveChangesAsync(ct);

        return Result<TaskItemDto>.Success(ToDto(task));
    }

    public async Task<Result<TaskItemDto>> CompleteAsync(Guid id, CancellationToken ct = default)
    {
        var task = await FindOwnedAsync(id, track: true, ct);
        if (task is null)
        {
            return Result<TaskItemDto>.Failure("Task not found.");
        }

        // A repeating task moves on to its next date and stays open (done once more).
        if (await NextOccurrenceAsync(task, ct) is { } next)
        {
            task.CompletedAtUtc = _dateTime.UtcNow; // when it was last done
            task.DueDateUtc = next;
            if (task.RecurrenceRule!.MaxOccurrences is { } left) task.RecurrenceRule.MaxOccurrences = left - 1;
            // Its reminders follow it ("30 minutes before" the new date).
            SetReminders(task, ReminderPlanner.ToDtos(task.Reminders), await _reminders.ZoneAsync(task.UserId, ct));
            await _db.SaveChangesAsync(ct);
            return Result<TaskItemDto>.Success(ToDto(task));
        }

        task.Status = TaskItemStatus.Completed;
        task.CompletedAtUtc = _dateTime.UtcNow;
        ReminderPlanner.TurnOff(task.Reminders, pausedWithItem: true);

        await _db.SaveChangesAsync(ct);
        return Result<TaskItemDto>.Success(ToDto(task));
    }

    public async Task<Result<TaskItemDto>> CancelAsync(Guid id, CancellationToken ct = default)
    {
        var task = await FindOwnedAsync(id, track: true, ct);
        if (task is null)
        {
            return Result<TaskItemDto>.Failure("Task not found.");
        }

        task.Status = TaskItemStatus.Cancelled;
        ReminderPlanner.TurnOff(task.Reminders, pausedWithItem: true);

        await _db.SaveChangesAsync(ct);
        return Result<TaskItemDto>.Success(ToDto(task));
    }

    public async Task<Result<TaskItemDto>> ReopenAsync(Guid id, CancellationToken ct = default)
    {
        var task = await FindOwnedAsync(id, track: true, ct);
        if (task is null)
        {
            return Result<TaskItemDto>.Failure("Task not found.");
        }

        if (task.Status is not (TaskItemStatus.Completed or TaskItemStatus.Cancelled))
        {
            return Result<TaskItemDto>.Failure("Only completed or cancelled tasks can be reopened.");
        }

        task.Status = DetermineInitialStatus(isOngoing: false, task.DueDateUtc);
        task.CompletedAtUtc = null;
        _reminders.Restore(task.Reminders, ReminderTime(task), await _reminders.ZoneAsync(task.UserId, ct), task.UserId, r => r.TaskItemId = task.Id);

        await _db.SaveChangesAsync(ct);
        return Result<TaskItemDto>.Success(ToDto(task));
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var task = await FindOwnedAsync(id, track: true, ct);
        if (task is null)
        {
            return Result.Failure("Task not found.");
        }

        task.IsDeleted = true;
        ReminderPlanner.TurnOff(task.Reminders);

        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }

    // ---- helpers -------------------------------------------------------

    private Guid RequireUserId() =>
        _currentUser.UserId ?? throw new UnauthorizedAccessException("No authenticated user.");

    private async Task<TaskItem?> FindOwnedAsync(Guid id, bool track, CancellationToken ct)
    {
        var userId = RequireUserId();

        var q = _db.TaskItems
            .Include(t => t.TaskTags).ThenInclude(tt => tt.Tag)
            .Include(t => t.Reminders)
            .Include(t => t.RecurrenceRule)
            .Where(t => t.Id == id && t.UserId == userId);

        if (!track)
        {
            q = q.AsNoTracking();
        }

        return await q.FirstOrDefaultAsync(ct);
    }

    private static TaskItemStatus DetermineInitialStatus(bool isOngoing, DateTime? dueDateUtc)
    {
        if (isOngoing)
        {
            return TaskItemStatus.Ongoing;
        }

        return dueDateUtc.HasValue ? TaskItemStatus.Planned : TaskItemStatus.Inbox;
    }

    private Task ApplyTagsAsync(TaskItem task, IReadOnlyList<string>? tagNames, CancellationToken ct) =>
        TagSync.ApplyAsync(_db, RequireUserId(), task.TaskTags, tagNames, tag => new TaskTag { TaskItem = task, Tag = tag }, ct);




    private void SetReminders(TaskItem task, IReadOnlyList<ReminderDto>? reminders, TimeZoneInfo zone) =>
        _reminders.Set(task.Reminders, reminders, ReminderTime(task), zone, task.UserId, r => r.TaskItemId = task.Id);

    /// <summary>What a "before" reminder counts back from: the due time (not a date-only due).</summary>
    private static DateTime? ReminderTime(TaskItem task) => task.HasDueTime ? task.DueDateUtc : null;

    private void SetRecurrence(TaskItem task, RecurrenceDto? spec, TimeZoneInfo zone)
    {
        // Only a task with a date (and not ongoing) can repeat.
        var wanted = task.DueDateUtc is null || task.Status == TaskItemStatus.Ongoing ? null : RecurrencePlanner.Pin(spec, task.DueDateUtc, zone);
        task.RecurrenceRule = RecurrencePlanner.Apply(_db, task.RecurrenceRule, wanted, task.UserId);
        task.RecurrenceRuleId = task.RecurrenceRule?.Id;
    }

    /// <summary>
    /// Where a repeating task goes when it's done: its next date after the current
    /// one - or, if that's already past (done late), the first one from today on.
    /// Null: it doesn't repeat, or the series is over.
    /// </summary>
    private async Task<DateTime?> NextOccurrenceAsync(TaskItem task, CancellationToken ct)
    {
        if (RecurrencePlanner.ToDto(task.RecurrenceRule) is not { } rule || task.DueDateUtc is not { } due) return null;
        if (rule.Count is <= 1) return null; // this was the last time
        var zone = await _reminders.ZoneAsync(task.UserId, ct);
        var counted = rule with { Count = null }; // the stored count is what's left, from this date on
        var next = RecurrenceSchedule.Next(counted, due, zone, due);
        var todayStart = UserTimeZoneHelper.LocalDateStartToUtc(DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(_dateTime.UtcNow, zone)), zone);
        if (next is { } n && n < todayStart) next = RecurrenceSchedule.Next(counted, due, zone, todayStart.AddTicks(-1));
        return next;
    }

    private static TaskItemDto ToDto(TaskItem t) => new(
        t.Id,
        t.Title,
        t.Description,
        t.Notes,
        t.AiSummary,
        t.StartDateUtc,
        t.DueDateUtc,
        t.HasDueTime,
        t.Status,
        t.Priority,
        t.CompletedAtUtc,
        t.TaskTags.Select(tt => tt.Tag.Name).OrderBy(n => n).ToList(),
        t.CreatedAtUtc,
        t.UpdatedAtUtc,
        ReminderPlanner.ToDtos(t.Reminders),
        t.SourceAiExtractionId,
        RecurrencePlanner.ToDto(t.RecurrenceRule));
}
