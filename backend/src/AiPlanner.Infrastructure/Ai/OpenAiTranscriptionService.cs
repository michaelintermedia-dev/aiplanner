using System.Net.Http.Headers;
using System.Text.Json;
using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Ai.Usage;
using AiPlanner.Application.Common.Exceptions;
using AiPlanner.Infrastructure.Ai.Usage;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AiPlanner.Infrastructure.Ai;

/// <summary>
/// Speech-to-text via OpenAI's /audio/transcriptions endpoint. The text comes
/// from TranscriptionModel - one call per audio part.
/// </summary>
public class OpenAiTranscriptionService : ITranscriptionService
{
    private readonly HttpClient _http;
    private readonly OpenAiOptions _options;
    private readonly ILogger<OpenAiTranscriptionService> _logger;
    private readonly IAiUsageMeter _meter;

    public OpenAiTranscriptionService(HttpClient http, IOptions<OpenAiOptions> options, ILogger<OpenAiTranscriptionService> logger, IAiUsageMeter meter)
    {
        _meter = meter;
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<TranscriptionResult> TranscribeAsync(Stream audio, string fileName, string? mimeType, CancellationToken ct = default)
    {
        // Recordings are at most a few MB.
        using var buffer = new MemoryStream();
        await audio.CopyToAsync(buffer, ct);
        var (text, language) = await TranscribeTextAsync(buffer.ToArray(), fileName, mimeType, ct);
        return new TranscriptionResult(text, language, $"OpenAI/{_options.TranscriptionModel}");
    }

    private async Task<(string Text, string? Language)> TranscribeTextAsync(byte[] bytes, string fileName, string? mimeType, CancellationToken ct)
    {
        using var form = Form(bytes, fileName, mimeType, _options.TranscriptionModel);
        form.Add(new StringContent("json"), "response_format");

        using var response = await OpenAiHttp.SendAsync(_http, new HttpRequestMessage(HttpMethod.Post, "audio/transcriptions") { Content = form }, _logger, ct);
        await using var body = await response.Content.ReadAsStreamAsync(ct);
        using var json = await JsonDocument.ParseAsync(body, cancellationToken: ct);
        _meter.Record(OpenAiUsage.FromTranscription(_options.TranscriptionModel, json.RootElement));

        var text = json.RootElement.TryGetProperty("text", out var t) ? t.GetString() : null;
        if (text is null)
        {
            throw new AiProviderException("The transcription response had no text.");
        }
        var language = json.RootElement.TryGetProperty("language", out var l) ? l.GetString() : null;
        return (text, language);
    }

    private static MultipartFormDataContent Form(byte[] bytes, string fileName, string? mimeType, string model)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        if (!string.IsNullOrWhiteSpace(mimeType))
        {
            file.Headers.ContentType = MediaTypeHeaderValue.Parse(mimeType);
        }
        form.Add(file, "file", fileName);
        form.Add(new StringContent(model), "model");
        return form;
    }
}
