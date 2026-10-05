namespace AiPlanner.Application.Captures.DTOs;

/// <summary>
/// More words for an existing capture: new recording parts and/or typed text.
/// ItemType/ItemId name the saved item the user is continuing from, so the AI
/// can tell additions to it from new things. KeepEarlier: the item's Edit form
/// collects several additions before Save - earlier unsaved ones stay pending.
/// ItemState: the Edit form's current (unsaved) state, in the AI's item shape -
/// the AI works on that instead of the saved item, so one addition can correct
/// another ("1 hour before instead of 30 minutes").
/// </summary>
public record ContinueCaptureRequest(
    string? Text, IReadOnlyList<AudioSegment> Audio, string? ItemType, Guid? ItemId, bool KeepEarlier = false, string? ItemState = null);
