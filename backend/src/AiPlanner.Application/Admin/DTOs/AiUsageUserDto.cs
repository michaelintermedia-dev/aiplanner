namespace AiPlanner.Application.Admin.DTOs;

/// <param name="ActiveDays">Days with at least one AI call.</param>
/// <param name="CostPerMessageUsd">All of the user's AI cost divided by their messages (null with no messages).</param>
public record AiUsageUserDto(
    Guid? UserId,
    string? Email,
    string? DisplayName,
    AiUsageTotalsDto Totals,
    int ActiveDays,
    decimal? CostPerMessageUsd);
