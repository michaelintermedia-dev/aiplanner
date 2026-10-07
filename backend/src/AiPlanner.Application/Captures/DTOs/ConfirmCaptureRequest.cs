namespace AiPlanner.Application.Captures.DTOs;

/// <summary>
/// The user's decision on the review screen (spec section 18). Every item the
/// user saw is listed: Include=false rejects it; Include=true saves it with the
/// (possibly edited) values given here. Items left out stay pending.
/// </summary>
/// KeepRecording=false deletes the recording once saved (the review's "Keep the
/// recording" checkbox); the words stay.
public record ConfirmCaptureRequest(IReadOnlyList<ConfirmCaptureItem> Items, bool KeepRecording = true);
