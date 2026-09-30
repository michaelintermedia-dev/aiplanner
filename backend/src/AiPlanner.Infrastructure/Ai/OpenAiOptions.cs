namespace AiPlanner.Infrastructure.Ai;

/// <summary>The "AiProvider" configuration section. The API key comes from user secrets / environment, never appsettings.</summary>
public class OpenAiOptions
{
    public const string SectionName = "AiProvider";

    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.openai.com/v1/";

    /// <summary>Model that turns text into title/summary/items.</summary>
    public string Model { get; set; } = "gpt-5.4-mini";

    /// <summary>Speech-to-text model.</summary>
    public string TranscriptionModel { get; set; } = "gpt-4o-transcribe";

    /// <summary>Reasoning effort for the extraction model ("low" keeps capture fast).</summary>
    public string? ReasoningEffort { get; set; } = "low";

    public int TimeoutSeconds { get; set; } = 120;
}
