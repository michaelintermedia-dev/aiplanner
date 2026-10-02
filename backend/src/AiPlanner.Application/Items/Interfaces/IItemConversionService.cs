using AiPlanner.Application.Common.Models;
using AiPlanner.Application.Items.DTOs;

namespace AiPlanner.Application.Items.Interfaces;

public interface IItemConversionService
{
    /// <summary>Turns a task, event or note into another type; the old item is replaced (soft-deleted).</summary>
    Task<Result<ConvertedItemDto>> ConvertAsync(ConvertItemRequest request, CancellationToken ct = default);
}
