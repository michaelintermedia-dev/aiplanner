using AiPlanner.Application.Admin.DTOs;
using AiPlanner.Domain.Entities;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Ai.Usage;

/// <summary>Adds up usage rows into totals (pure - unit tested).</summary>
public static class AiUsageSummary
{
    public static AiUsageTotalsDto Totals(IReadOnlyCollection<AiUsage> rows, IReadOnlyDictionary<string, ModelPrice> prices) => new(
        Calls: rows.Count,
        Messages: rows.Count(r => r.Kind == AiUsageKind.Extraction),
        Transcriptions: rows.Count(r => r.Kind == AiUsageKind.Transcription),
        MediaDescriptions: rows.Count(r => r.Kind == AiUsageKind.MediaDescription),
        InputTokens: rows.Sum(r => (long)r.InputTokens),
        OutputTokens: rows.Sum(r => (long)r.OutputTokens),
        CostUsd: Math.Round(rows.Sum(r => AiPricing.Cost(r, prices) ?? 0m), 4));

    /// <summary>Models used that have no price configured - their calls count as free, which is wrong.</summary>
    public static IReadOnlyList<string> Unpriced(IEnumerable<AiUsage> rows, IReadOnlyDictionary<string, ModelPrice> prices) =>
        rows.Select(r => r.Model).Distinct(StringComparer.OrdinalIgnoreCase)
            .Where(m => AiPricing.PriceFor(m, prices) is null)
            .Order(StringComparer.OrdinalIgnoreCase)
            .ToList();
}
