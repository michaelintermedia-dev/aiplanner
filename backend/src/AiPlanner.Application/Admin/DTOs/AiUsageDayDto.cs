namespace AiPlanner.Application.Admin.DTOs;

/// <param name="Date">UTC date, yyyy-MM-dd.</param>
public record AiUsageDayDto(string Date, int Calls, int Messages, decimal CostUsd);
