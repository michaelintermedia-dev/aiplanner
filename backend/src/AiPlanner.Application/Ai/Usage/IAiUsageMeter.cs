using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Ai.Usage;

/// <summary>
/// Records what an AI call used, for the user it was made for (the signed-in
/// user, or the one an <see cref="AiUsageScope"/> names - background jobs).
/// Never throws and never slows the call: rows are written in the background.
/// </summary>
public interface IAiUsageMeter
{
    void Record(AiCall call);
}

/// <summary>What the provider said one call used.</summary>
public record AiCall(
    AiUsageKind Kind,
    string Model,
    int InputTokens,
    int CachedInputTokens = 0,
    int AudioInputTokens = 0,
    int OutputTokens = 0,
    double? AudioSeconds = null);
