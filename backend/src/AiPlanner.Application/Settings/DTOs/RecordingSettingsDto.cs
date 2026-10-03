namespace AiPlanner.Application.Settings.DTOs;

/// <summary>How voice recordings are saved.</summary>
/// <param name="ShortenPauses">Cut pauses longer than a second down to a short gap.</param>
public record RecordingSettingsDto(bool ShortenPauses);
