using AiPlanner.Application.Common.Exceptions;
using Microsoft.Extensions.Logging;

namespace AiPlanner.Infrastructure.Ai;

/// <summary>Shared send + error mapping for OpenAI calls.</summary>
internal static class OpenAiHttp
{
    public static async Task<HttpResponseMessage> SendAsync(HttpClient http, HttpRequestMessage request, ILogger logger, CancellationToken ct)
    {
        if (http.DefaultRequestHeaders.Authorization is null)
        {
            throw new AiProviderException("The AI provider is not configured (set AiProvider:ApiKey).");
        }

        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, ct);
        }
        catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
        {
            throw new AiProviderException("The AI provider timed out.", ex);
        }
        catch (HttpRequestException ex)
        {
            throw new AiProviderException("Could not reach the AI provider.", ex);
        }

        if (!response.IsSuccessStatusCode)
        {
            // The error body describes the request problem (bad model, quota...), not user content.
            var body = await response.Content.ReadAsStringAsync(ct);
            logger.LogWarning("OpenAI {Path} returned {Status}: {Body}", request.RequestUri, (int)response.StatusCode, body.Length > 1000 ? body[..1000] : body);
            response.Dispose();
            throw new AiProviderException($"The AI provider returned {(int)response.StatusCode}.");
        }

        return response;
    }
}
