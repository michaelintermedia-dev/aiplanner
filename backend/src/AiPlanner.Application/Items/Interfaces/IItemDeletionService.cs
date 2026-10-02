using AiPlanner.Application.Common.Models;
using AiPlanner.Application.Items.DTOs;

namespace AiPlanner.Application.Items.Interfaces;

public interface IItemDeletionService
{
    /// <summary>Soft-deletes the selected items (any mix of types) in one go; already-gone ones are skipped.</summary>
    Task<Result<ItemsResultDto>> DeleteAsync(ItemsRequest request, CancellationToken ct = default);

    /// <summary>Undo: brings deleted items back, with the reminders they had.</summary>
    Task<Result<ItemsResultDto>> RestoreAsync(ItemsRequest request, CancellationToken ct = default);
}
