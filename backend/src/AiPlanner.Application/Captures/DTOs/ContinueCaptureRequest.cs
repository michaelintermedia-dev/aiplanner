namespace AiPlanner.Application.Captures.DTOs;

/// <summary>
/// More words for an existing capture: new recording parts and/or typed text.
/// ItemType/ItemId name the saved item the user is continuing from, so the AI
/// can tell additions to it from new things.
/// </summary>
public record ContinueCaptureRequest(string? Text, IReadOnlyList<AudioSegment> Audio, string? ItemType, Guid? ItemId);
