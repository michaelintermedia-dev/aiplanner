namespace AiPlanner.Application.Items.DTOs;

/// <summary>A selection of items, e.g. the ones picked in the feed.</summary>
public record ItemsRequest(IReadOnlyList<ItemRef> Items);
