namespace AiPlanner.Application.Items.DTOs;

/// <summary>
/// The new item. NeedsDetails: something the new type requires had to be
/// guessed (an event's time), so the client opens it for editing.
/// </summary>
public record ConvertedItemDto(string ItemType, Guid Id, bool NeedsDetails);
