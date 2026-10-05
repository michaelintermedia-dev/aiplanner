namespace AiPlanner.Application.Captures.DTOs;

/// <summary>An item to add voice or text to ("Task" | "Appointment" | "Note").</summary>
public record CaptureForItemRequest(string ItemType, Guid ItemId);
