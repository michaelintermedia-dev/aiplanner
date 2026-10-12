using System.Net;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Common.Utils;
using Microsoft.Extensions.Logging;

namespace AiPlanner.Infrastructure.Ai;

/// <summary>
/// Looks up what shared links are (user's request, 2026-10-12): a YouTube video
/// through YouTube's oEmbed, any other page by its og:title / &lt;title&gt;. Only
/// public internet addresses are ever connected to (see <see cref="Handler"/>),
/// each look-up gets 5 seconds and at most 256 KB of the page. Failures just
/// mean no title.
/// </summary>
public partial class HttpLinkPreviewService : ILinkPreviewService
{
    private const int MaxBytes = 256 * 1024;
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5);

    private readonly HttpClient _http;
    private readonly ILogger<HttpLinkPreviewService> _logger;

    public HttpLinkPreviewService(HttpClient http, ILogger<HttpLinkPreviewService> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task<IReadOnlyList<LinkPreview>> PreviewAsync(IReadOnlyList<string> urls, CancellationToken ct = default)
    {
        var started = DateTime.UtcNow;
        var found = await Task.WhenAll(urls.Select(u => OneAsync(u, ct)));
        // Counts and timing only - never the links themselves (they're the user's content).
        _logger.LogInformation("Link previews: {Found} of {Count} titled in {ElapsedMs} ms", found.Count(f => f.Title is not null), urls.Count, (DateTime.UtcNow - started).TotalMilliseconds);
        return found;
    }

    private async Task<LinkPreview> OneAsync(string url, CancellationToken ct)
    {
        var none = new LinkPreview(url, null, null);
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)) return none;
        using var limit = CancellationTokenSource.CreateLinkedTokenSource(ct);
        limit.CancelAfter(Timeout);
        try
        {
            if (IsYouTube(uri))
            {
                var oembed = await _http.GetFromJsonAsync<JsonObject>($"https://www.youtube.com/oembed?format=json&url={Uri.EscapeDataString(url)}", limit.Token);
                var title = Clean(oembed?["title"]?.GetValue<string>());
                var channel = Clean(oembed?["author_name"]?.GetValue<string>());
                // The channel as part of the site (a video title often has the channel already).
                return new LinkPreview(url, title, channel is null ? "YouTube" : $"YouTube, channel {channel}");
            }

            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            request.Headers.Accept.ParseAdd("text/html,application/xhtml+xml");
            using var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, limit.Token);
            var type = response.Content.Headers.ContentType;
            if (!response.IsSuccessStatusCode || type?.MediaType is not ("text/html" or "application/xhtml+xml")) return none;
            var html = await ReadStartAsync(response, type.CharSet, limit.Token);
            return new LinkPreview(url, Clean(Meta(html, "og:title") ?? Meta(html, "twitter:title") ?? TitleTag().Match(html).Groups[1].Value), Clean(Meta(html, "og:site_name")));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or OperationCanceledException or System.Text.Json.JsonException or NotSupportedException or InvalidOperationException)
        {
            if (ct.IsCancellationRequested) throw;
            return none;
        }
    }

    private static bool IsYouTube(Uri uri) =>
        uri.Host.Equals("youtu.be", StringComparison.OrdinalIgnoreCase)
        || uri.Host.Equals("youtube.com", StringComparison.OrdinalIgnoreCase)
        || uri.Host.EndsWith(".youtube.com", StringComparison.OrdinalIgnoreCase);

    /// <summary>The first MaxBytes of the page, decoded with its charset (UTF-8 when unknown).</summary>
    private static async Task<string> ReadStartAsync(HttpResponseMessage response, string? charset, CancellationToken ct)
    {
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        var buffer = new byte[MaxBytes];
        var read = 0;
        while (read < buffer.Length)
        {
            var n = await stream.ReadAsync(buffer.AsMemory(read), ct);
            if (n == 0) break;
            read += n;
        }
        Encoding encoding;
        try { encoding = string.IsNullOrWhiteSpace(charset) ? Encoding.UTF8 : Encoding.GetEncoding(charset.Trim('"')); }
        catch (ArgumentException) { encoding = Encoding.UTF8; }
        return encoding.GetString(buffer, 0, read);
    }

    private static string? Meta(string html, string property)
    {
        foreach (Match m in MetaTag().Matches(html))
        {
            var tag = m.Value;
            var key = AttrValue(tag, "property") ?? AttrValue(tag, "name");
            if (string.Equals(key, property, StringComparison.OrdinalIgnoreCase)) return AttrValue(tag, "content");
        }
        return null;
    }

    private static string? AttrValue(string tag, string name)
    {
        var m = Regex.Match(tag, $@"\b{name}\s*=\s*(?:""([^""]*)""|'([^']*)')", RegexOptions.IgnoreCase);
        return m.Success ? (m.Groups[1].Success ? m.Groups[1].Value : m.Groups[2].Value) : null;
    }

    private static string? Clean(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var clean = Regex.Replace(WebUtility.HtmlDecode(text), @"\s+", " ").Trim();
        return clean.Length == 0 ? null : clean.Length > 200 ? clean[..200] : clean;
    }

    [GeneratedRegex(@"<title[^>]*>(.*?)</title>", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex TitleTag();

    [GeneratedRegex(@"<meta\b[^>]*>", RegexOptions.IgnoreCase)]
    private static partial Regex MetaTag();

    /// <summary>
    /// The handler for this client: every connection - redirects included - goes
    /// only to public internet addresses (the name is resolved here and checked
    /// before connecting, so DNS tricks can't point it inside).
    /// </summary>
    public static SocketsHttpHandler Handler() => new()
    {
        AllowAutoRedirect = true,
        MaxAutomaticRedirections = 3,
        AutomaticDecompression = DecompressionMethods.All,
        PooledConnectionLifetime = TimeSpan.FromMinutes(2),
        ConnectTimeout = TimeSpan.FromSeconds(4),
        ConnectCallback = async (context, ct) =>
        {
            var addresses = await Dns.GetHostAddressesAsync(context.DnsEndPoint.Host, ct);
            var allowed = addresses.Where(PublicAddress.IsPublic).ToArray();
            if (allowed.Length == 0) throw new HttpRequestException("Not a public address.");
            var socket = new Socket(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
            try
            {
                await socket.ConnectAsync(allowed, context.DnsEndPoint.Port, ct);
                return new NetworkStream(socket, ownsSocket: true);
            }
            catch
            {
                socket.Dispose();
                throw;
            }
        },
    };
}
