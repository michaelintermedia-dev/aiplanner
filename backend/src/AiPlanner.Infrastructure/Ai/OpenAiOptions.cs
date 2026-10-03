namespace AiPlanner.Infrastructure.Ai;

/// <summary>The "AiProvider" configuration section. The API key comes from user secrets / environment, never appsettings.</summary>
public class OpenAiOptions
{
    public const string SectionName = "AiProvider";

    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.openai.com/v1/";

    /// <summary>Model that turns text into title/summary/items.</summary>
    public string Model { get; set; } = "gpt-5.4-mini";

    /// <summary>
    /// Speech-to-text model. gpt-4o-mini-transcribe rather than gpt-4o-transcribe:
    /// on recordings that were paused and continued, gpt-4o-transcribe stopped at
    /// the first cut and dropped the rest (tested 2026-09-30); mini kept it all.
    /// </summary>
    public string TranscriptionModel { get; set; } = "gpt-4o-mini-transcribe";

    /// <summary>
    /// Model asked separately for word timestamps, so each item can play just its
    /// part of a recording (only whisper-1 returns them). Empty = no timings.
    /// </summary>
    public string? TimingModel { get; set; } = "whisper-1";

    /// <summary>Reasoning effort for the extraction model ("low" keeps capture fast).</summary>
    public string? ReasoningEffort { get; set; } = "low";

    public int TimeoutSeconds { get; set; } = 120;
}
