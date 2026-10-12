using AiPlanner.Domain.Enums;

namespace AiPlanner.Domain.Entities;

/// <summary>
/// One AI provider call and what the provider says it used - for knowing what
/// each user costs (production prep, 2026-10-10). Only counts, never content.
/// The money is worked out when reported (AiPricing), from these counts and the
/// configured prices, so a price change or a wrong price never needs a data fix.
/// A log row: no soft delete, no concurrency token.
/// </summary>
public class AiUsage
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Who it was for; null if it couldn't be told (shouldn't happen).</summary>
    public Guid? UserId { get; set; }

    public DateTime AtUtc { get; set; }
    public AiUsageKind Kind { get; set; }
    public string Model { get; set; } = string.Empty;

    /// <summary>All input tokens (text, images and audio together; cached ones included).</summary>
    public int InputTokens { get; set; }

    /// <summary>The part of InputTokens served from the provider's cache (cheaper).</summary>
    public int CachedInputTokens { get; set; }

    /// <summary>The part of InputTokens that was audio (transcription).</summary>
    public int AudioInputTokens { get; set; }

    /// <summary>Output tokens (reasoning included).</summary>
    public int OutputTokens { get; set; }

    /// <summary>Audio length, when the provider bills by duration instead of tokens.</summary>
    public double? AudioSeconds { get; set; }
}
