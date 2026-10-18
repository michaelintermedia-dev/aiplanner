using AiPlanner.Domain.Entities;

namespace AiPlanner.Application.Notifications.Push;

public enum PushResult { Sent, Gone, Failed }

/// <summary>Sends web push messages (Infrastructure: VAPID). Off when no keys are configured.</summary>
public interface IWebPushSender
{
    bool Enabled { get; }
    /// <summary>The VAPID public key browsers subscribe with (null: web push is off).</summary>
    string? PublicKey { get; }
    Task<PushResult> SendAsync(PushSubscription subscription, string payloadJson, CancellationToken ct = default);
}
