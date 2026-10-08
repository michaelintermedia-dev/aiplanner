namespace AiPlanner.Application.Settings.DTOs;

/// <summary>How captures and voice recordings are saved (Settings - Recordings).</summary>
/// <param name="KeepRecordings">Keep the audio of a voice capture when it's saved (the default of the review's checkbox, and what Save does).</param>
/// <param name="OneEntryPerMessage">Everything said in one message becomes one item.</param>
/// <param name="AiReadsMedia">Photos/documents added while capturing may go to OpenAI for the AI to read. Null = not asked yet (a PUT with null keeps it).</param>
public record RecordingSettingsDto(bool KeepRecordings = true, bool OneEntryPerMessage = true, bool? AiReadsMedia = null);
