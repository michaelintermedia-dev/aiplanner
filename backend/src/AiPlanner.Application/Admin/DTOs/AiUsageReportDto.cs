namespace AiPlanner.Application.Admin.DTOs;

/// <summary>What AI cost over a period: in total, per user and per day. Money in US dollars, from the configured prices.</summary>
public record AiUsageReportDto(
    DateTime FromUtc,
    DateTime ToUtc,
    int Days,
    AiUsageTotalsDto Total,
    IReadOnlyList<AiUsageUserDto> Users,
    IReadOnlyList<AiUsageDayDto> PerDay,
    IReadOnlyList<string> UnpricedModels);
