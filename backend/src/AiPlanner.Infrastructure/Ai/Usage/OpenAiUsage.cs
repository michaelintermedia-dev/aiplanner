using System.Text.Json;
using System.Text.Json.Nodes;
using AiPlanner.Application.Ai.Usage;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Infrastructure.Ai.Usage;

/// <summary>Reads the "usage" object of OpenAI answers (pure - unit tested).</summary>
public static class OpenAiUsage
{
    /// <summary>Chat Completions: prompt_tokens (+ details: cached_tokens, audio_tokens), completion_tokens.</summary>
    public static AiCall FromChat(AiUsageKind kind, string model, JsonNode? usage) => new(
        kind,
        model,
        InputTokens: Int(usage?["prompt_tokens"]),
        CachedInputTokens: Int(usage?["prompt_tokens_details"]?["cached_tokens"]),
        AudioInputTokens: Int(usage?["prompt_tokens_details"]?["audio_tokens"]),
        OutputTokens: Int(usage?["completion_tokens"]));

    /// <summary>
    /// Transcriptions: {"type":"tokens", input_tokens, input_token_details: {audio_tokens}, output_tokens}
    /// or {"type":"duration", seconds}.
    /// </summary>
    public static AiCall FromTranscription(string model, JsonElement root)
    {
        if (!root.TryGetProperty("usage", out var u) || u.ValueKind != JsonValueKind.Object)
        {
            return new AiCall(AiUsageKind.Transcription, model, 0);
        }
        var node = JsonNode.Parse(u.GetRawText());
        if (node?["type"]?.GetValue<string>() == "duration")
        {
            return new AiCall(AiUsageKind.Transcription, model, 0, AudioSeconds: Double(node["seconds"]));
        }
        return new AiCall(
            AiUsageKind.Transcription,
            model,
            InputTokens: Int(node?["input_tokens"]),
            AudioInputTokens: Int(node?["input_token_details"]?["audio_tokens"]),
            OutputTokens: Int(node?["output_tokens"]));
    }

    private static int Int(JsonNode? n) => n is JsonValue v && v.TryGetValue<int>(out var i) ? i : 0;

    private static double? Double(JsonNode? n) => n is JsonValue v && v.TryGetValue<double>(out var d) ? d : null;
}
