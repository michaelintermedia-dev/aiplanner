using AiPlanner.Application.Common.Models;
using AiPlanner.Application.Tasks.DTOs;

namespace AiPlanner.Application.Tasks.Interfaces;

public interface ITaskService
{
    Task<IReadOnlyList<TaskItemDto>> GetListAsync(TaskQueryParameters query, CancellationToken ct = default);

    Task<Result<TaskItemDto>> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<Result<TaskItemDto>> CreateAsync(CreateTaskRequest request, CancellationToken ct = default);

    Task<Result<TaskItemDto>> UpdateAsync(Guid id, UpdateTaskRequest request, CancellationToken ct = default);

    Task<Result<TaskItemDto>> CompleteAsync(Guid id, CancellationToken ct = default);

    Task<Result<TaskItemDto>> CancelAsync(Guid id, CancellationToken ct = default);

    /// <summary>Moves a Cancelled/Completed task back to Planned (or Ongoing has no due date -> Ongoing).</summary>
    Task<Result<TaskItemDto>> ReopenAsync(Guid id, CancellationToken ct = default);

    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
}
