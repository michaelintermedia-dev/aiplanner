namespace AiPlanner.Domain.Entities;

/// <summary>
/// A browser that receives web push (2026-10-18): reminders arrive even with
/// the tab closed. The browser's push address and keys - no content.
/// </summary>
public class PushSubscription
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    /// <summary>The push service's URL for this browser (unique).</summary>
    public string Endpoint { get; set; } = default!;
    public string P256dh { get; set; } = default!;
    public string Auth { get; set; } = default!;
    public DateTime CreatedAtUtc { get; set; }
}
