using System.Net.Http.Headers;
using System.Text.Json;
using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Common.Exceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AiPlanner.Infrastructure.Ai;

/// <summary>Speech-to-text via OpenAI's /audio/transcriptions endpoint.</summary>
public class OpenAiTranscriptionService : ITranscriptionService
{
    private readonly HttpClient _http;
    private readonly OpenAiOptions _options;
    private readonly ILogger<OpenAiTranscriptionService> _logger;

    public OpenAiTranscriptionService(HttpClient http, IOptions<OpenAiOptions> options, ILogger<OpenAiTranscriptionService> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<TranscriptionResult> TranscribeAsync(Stream audio, string fileName, string? mimeType, CancellationToken ct = default)
    {
        using var form = new MultipartFormDataContent();
        var file = new StreamContent(audio);
        if (!string.IsNullOrWhiteSpace(mimeType))
        {
            file.Headers.ContentType = MediaTypeHeaderValue.Parse(mimeType);
        }
        form.Add(file, "file", fileName);
        form.Add(new StringContent(_options.TranscriptionModel), "model");
        form.Add(new StringContent("json"), "response_format");

        using var response = await OpenAiHttp.SendAsync(_http, new HttpRequestMessage(HttpMethod.Post, "audio/transcriptions") { Content = form }, _logger, ct);
        await using var body = await response.Content.ReadAsStreamAsync(ct);
        using var json = await JsonDocument.ParseAsync(body, cancellationToken: ct);

        var text = json.RootElement.TryGetProperty("text", out var t) ? t.GetString() : null;
        if (text is null)
        {
            throw new AiProviderException("The transcription response had no text.");
        }
        var language = json.RootElement.TryGetProperty("language", out var l) ? l.GetString() : null;

        return new TranscriptionResult(text, language, $"OpenAI/{_options.TranscriptionModel}");
    }
}
