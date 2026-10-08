using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Common.Exceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AiPlanner.Infrastructure.Ai;

/// <summary>Attachment descriptions via OpenAI Chat Completions (plain text answer, same model as extraction).</summary>
public class OpenAiMediaDescriptionService : IMediaDescriptionService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _http;
    private readonly OpenAiOptions _options;
    private readonly ILogger<OpenAiMediaDescriptionService> _logger;

    public OpenAiMediaDescriptionService(HttpClient http, IOptions<OpenAiOptions> options, ILogger<OpenAiMediaDescriptionService> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<string> DescribeAsync(MediaInput media, string locale, CancellationToken ct = default)
    {
        var body = new JsonObject
        {
            ["model"] = _options.Model,
            ["messages"] = new JsonArray
            {
                new JsonObject { ["role"] = "system", ["content"] = Instructions(locale) },
                new JsonObject { ["role"] = "user", ["content"] = new JsonArray { OpenAiMediaParts.Part(media) } },
            },
        };
        if (!string.IsNullOrWhiteSpace(_options.ReasoningEffort))
        {
            body["reasoning_effort"] = _options.ReasoningEffort;
        }

        var request = new HttpRequestMessage(HttpMethod.Post, "chat/completions") { Content = JsonContent.Create(body) };
        using var response = await OpenAiHttp.SendAsync(_http, request, _logger, ct);
        var json = await response.Content.ReadFromJsonAsync<JsonObject>(JsonOptions, ct)
            ?? throw new AiProviderException("Empty response from the AI provider.");
        var text = json["choices"]?[0]?["message"]?["content"]?.GetValue<string>();
        return string.IsNullOrWhiteSpace(text) ? throw new AiProviderException("The AI provider returned no description.") : text;
    }

    internal static string Instructions(string locale) => $"""
        You describe a file attached to an entry in someone's personal planner, so they can find it later by searching.
        Answer with plain text only (no markdown), at most 4 short lines:
        1. What it is, specifically ("Receipt from IKEA", "Concert flyer - Jazz Night at Blue Note", "Photo of a router label", "Lease agreement").
        2-4. The key facts and any readable text someone might search for: names, places, dates, amounts, codes, passwords, phone numbers, addresses.
        Also use the everyday words someone would type to find it, even if the file says it differently (a router label: "wifi", "password"; a boarding pass: "flight", "ticket").
        Write in the language of the text in the file; if it has no text, in the language of the locale "{locale}".
        Never invent anything that isn't in the file.
        """;
}
