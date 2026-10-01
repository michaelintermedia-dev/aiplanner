namespace AiPlanner.Application.Notifications.DTOs;

/// <summary>"Remind me again in N minutes" about an item (from a notification action).</summary>
public record SnoozeRequest(string ItemType, Guid ItemId, string Title, string? Body, int Minutes);
