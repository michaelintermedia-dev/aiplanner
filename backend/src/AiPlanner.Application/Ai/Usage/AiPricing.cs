using AiPlanner.Domain.Entities;

namespace AiPlanner.Application.Ai.Usage;

/// <summary>
/// The "AiPricing" configuration section: US dollars per million tokens (or per
/// minute of audio) for each model. Keep it in line with the provider's price
/// list - reports are only as right as these numbers.
/// </summary>
public class AiPricingOptions
{
    public const string SectionName = "AiPricing";

    /// <summary>By model name; a dated model ("gpt-x-2026-01-01") uses its base name's price.</summary>
    public Dictionary<string, ModelPrice> Models { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public class ModelPrice
{
    /// <summary>Text (and image) input, per million tokens.</summary>
    public decimal InputPerMillion { get; set; }

    /// <summary>Cached input, per million tokens; 0 = same as input.</summary>
    public decimal CachedInputPerMillion { get; set; }

    /// <summary>Audio input, per million tokens; 0 = same as input.</summary>
    public decimal AudioInputPerMillion { get; set; }

    public decimal OutputPerMillion { get; set; }

    /// <summary>When the provider bills audio by duration.</summary>
    public decimal PerAudioMinute { get; set; }
}

/// <summary>What calls cost (pure - unit tested).</summary>
public static class AiPricing
{
    /// <summary>The price for a model: its own, else the longest configured name it starts with; null = not configured.</summary>
    public static ModelPrice? PriceFor(string model, IReadOnlyDictionary<string, ModelPrice> prices)
    {
        if (prices.TryGetValue(model, out var exact)) return exact;
        return prices
            .Where(p => model.StartsWith(p.Key + "-", StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(p => p.Key.Length)
            .Select(p => p.Value)
            .FirstOrDefault();
    }

    /// <summary>The call's cost in US dollars; null when the model has no price.</summary>
    public static decimal? Cost(AiUsage u, IReadOnlyDictionary<string, ModelPrice> prices)
    {
        if (PriceFor(u.Model, prices) is not { } p) return null;
        var cached = Math.Min(u.CachedInputTokens, u.InputTokens);
        var audio = Math.Min(u.AudioInputTokens, u.InputTokens - cached);
        var text = u.InputTokens - cached - audio;
        var cost =
            text * p.InputPerMillion
            + cached * (p.CachedInputPerMillion > 0 ? p.CachedInputPerMillion : p.InputPerMillion)
            + audio * (p.AudioInputPerMillion > 0 ? p.AudioInputPerMillion : p.InputPerMillion)
            + u.OutputTokens * p.OutputPerMillion;
        cost /= 1_000_000m;
        if (u.AudioSeconds is { } seconds) cost += (decimal)seconds / 60m * p.PerAudioMinute;
        return cost;
    }
}
