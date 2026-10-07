namespace AiPlanner.Application.Settings.DTOs;

/// <summary>How captures and voice recordings are saved (Settings - Recordings).</summary>
/// <param name="ShortenPauses">Cut pauses longer than a second down to a short gap.</param>
/// <param name="KeepRecordings">Keep the audio of a voice capture when it's saved (the default of the review's checkbox).</param>
/// <param name="OneEntryPerMessage">Everything said in one message becomes one item.</param>
/// <param name="SaveRightAway">Save what was understood at once, without the review (falls back to a note).</param>
public record RecordingSettingsDto(bool ShortenPauses, bool KeepRecordings = true, bool OneEntryPerMessage = true, bool SaveRightAway = false);
