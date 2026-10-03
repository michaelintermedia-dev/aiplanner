using System.Net.Http.Headers;
using System.Text.Json;
using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Common.Exceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AiPlanner.Infrastructure.Ai;

/// <summary>
/// Speech-to-text via OpenAI's /audio/transcriptions endpoint. The text comes
/// from TranscriptionModel; word timings (which only whisper-1 returns) come
/// from a second, parallel call to TimingModel. Timings are a nice-to-have:
/// if that call fails, the transcript still goes through without them.
/// </summary>
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
        // Both calls need the bytes; recordings are at most a few MB.
        using var buffer = new MemoryStream();
        await audio.CopyToAsync(buffer, ct);
        var bytes = buffer.ToArray();

        var textTask = TranscribeTextAsync(bytes, fileName, mimeType, ct);
        var timingTask = string.IsNullOrWhiteSpace(_options.TimingModel)
            ? Task.FromResult<(IReadOnlyList<TimedWord>?, int?)>((null, null))
            : TimeWordsAsync(bytes, fileName, mimeType, ct);
        await Task.WhenAll(textTask, timingTask);

        var (text, language) = textTask.Result;
        var (words, durationMs) = timingTask.Result;
        return new TranscriptionResult(text, language, $"OpenAI/{_options.TranscriptionModel}", words, durationMs);
    }

    private async Task<(string Text, string? Language)> TranscribeTextAsync(byte[] bytes, string fileName, string? mimeType, CancellationToken ct)
    {
        using var form = Form(bytes, fileName, mimeType, _options.TranscriptionModel);
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
        return (text, language);
    }

    /// <summary>Word timestamps (verbose_json + timestamp_granularities=word). Never throws.</summary>
    private async Task<(IReadOnlyList<TimedWord>? Words, int? DurationMs)> TimeWordsAsync(byte[] bytes, string fileName, string? mimeType, CancellationToken ct)
    {
        try
        {
            using var form = Form(bytes, fileName, mimeType, _options.TimingModel!);
            form.Add(new StringContent("verbose_json"), "response_format");
            form.Add(new StringContent("word"), "timestamp_granularities[]");

            using var response = await OpenAiHttp.SendAsync(_http, new HttpRequestMessage(HttpMethod.Post, "audio/transcriptions") { Content = form }, _logger, ct);
            await using var body = await response.Content.ReadAsStreamAsync(ct);
            using var json = await JsonDocument.ParseAsync(body, cancellationToken: ct);
            var root = json.RootElement;

            int? durationMs = root.TryGetProperty("duration", out var d) && d.ValueKind == JsonValueKind.Number
                ? (int)Math.Round(d.GetDouble() * 1000) : null;
            if (!root.TryGetProperty("words", out var list) || list.ValueKind != JsonValueKind.Array)
            {
                return (null, durationMs);
            }
            var words = new List<TimedWord>();
            foreach (var w in list.EnumerateArray())
            {
                var word = w.TryGetProperty("word", out var ww) ? ww.GetString() : null;
                if (string.IsNullOrWhiteSpace(word) || !w.TryGetProperty("start", out var s) || !w.TryGetProperty("end", out var e)) continue;
                words.Add(new TimedWord(word, (int)Math.Round(s.GetDouble() * 1000), (int)Math.Round(e.GetDouble() * 1000)));
            }
            return (words, durationMs);
        }
        catch (Exception ex) when (ex is AiProviderException or HttpRequestException or JsonException
                                   || (ex is TaskCanceledException && !ct.IsCancellationRequested))
        {
            // Only the per-item snippets are lost, never the transcript. No user content in the log.
            _logger.LogWarning("Word timings unavailable ({Error}); items will use the whole recording", ex.GetType().Name);
            return (null, null);
        }
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
