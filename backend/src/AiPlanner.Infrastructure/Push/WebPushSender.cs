using System.Net;
using AiPlanner.Application.Notifications.Push;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using WebPush;
using Subscription = AiPlanner.Domain.Entities.PushSubscription;

namespace AiPlanner.Infrastructure.Push;

/// <summary>
/// Web push with VAPID keys (WebPush:PublicKey / PrivateKey / Subject - prod env
/// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY). No keys = off: the web then only
/// notifies while a tab is open.
/// </summary>
public class WebPushSender : IWebPushSender
{
    private readonly WebPushClient _client;
    private readonly VapidDetails? _vapid;
    private readonly ILogger<WebPushSender> _logger;

    public WebPushSender(HttpClient http, IConfiguration config, ILogger<WebPushSender> logger)
    {
        _client = new WebPushClient(http);
        _logger = logger;
        var publicKey = config["WebPush:PublicKey"];
        var privateKey = config["WebPush:PrivateKey"];
        if (!string.IsNullOrWhiteSpace(publicKey) && !string.IsNullOrWhiteSpace(privateKey))
        {
            _vapid = new VapidDetails(config["WebPush:Subject"] ?? "mailto:hello@gatazee.com", publicKey, privateKey);
        }
    }

    public bool Enabled => _vapid is not null;
    public string? PublicKey => _vapid?.PublicKey;

    public async Task<PushResult> SendAsync(Subscription subscription, string payloadJson, CancellationToken ct = default)
    {
        if (_vapid is null) return PushResult.Failed;
        try
        {
            await _client.SendNotificationAsync(new PushSubscription(subscription.Endpoint, subscription.P256dh, subscription.Auth), payloadJson, _vapid, ct);
            return PushResult.Sent;
        }
        catch (WebPushException e) when (e.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Gone)
        {
            return PushResult.Gone; // the browser unsubscribed, or the subscription expired
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            _logger.LogWarning("Web push failed for subscription {Id}: {Error}", subscription.Id, e.Message);
            return PushResult.Failed;
        }
    }
}
