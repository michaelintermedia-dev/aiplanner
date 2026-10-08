namespace AiPlanner.Application.Captures.DTOs;

/// <param name="SaveNow">The smart Save button: save at once when everything was understood clearly (else the review).</param>
public record CaptureTextRequest(string Text, bool SaveNow = false);
