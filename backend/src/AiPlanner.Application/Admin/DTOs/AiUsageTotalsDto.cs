namespace AiPlanner.Application.Admin.DTOs;

/// <param name="Messages">Messages the AI read (one extraction call each - a new entry or an addition).</param>
/// <param name="CostUsd">Calls whose model has no configured price count as 0 (see UnpricedModels).</param>
public record AiUsageTotalsDto(
    int Calls,
    int Messages,
    int Transcriptions,
    int MediaDescriptions,
    long InputTokens,
    long OutputTokens,
    decimal CostUsd);
