namespace AiPlanner.Application.Captures.DTOs;

/// <summary>A row in the capture history list (spec section 21).</summary>
public record CaptureSummaryDto(
    Guid Id,
    string Source,
    string Title,
    string? Summary,
    DateTime CreatedAtUtc,
    int ItemCount,
    int PendingCount);
