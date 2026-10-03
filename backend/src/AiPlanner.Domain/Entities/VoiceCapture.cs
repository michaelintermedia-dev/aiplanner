using AiPlanner.Domain.Common;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Domain.Entities;

public class VoiceCapture : BaseEntity
{
    /// <summary>
    /// Keys of the recording's audio files in IFileStorageService, in speaking
    /// order. Usually one; the mobile app uploads one file per segment (each
    /// pause finalizes a segment). Empty after the user deletes the recording.
    /// </summary>
    public List<string> AudioStorageKeys { get; set; } = [];

    /// <summary>
    /// Length of each audio file (same order as AudioStorageKeys), so item
    /// snippets (AIExtractionItem.AudioStartMs) can be placed across parts.
    /// Empty when unknown.
    /// </summary>
    public List<int> AudioPartDurationsMs { get; set; } = [];
    public string? MimeType { get; set; }
    public int? DurationSeconds { get; set; }
    public VoiceCaptureStatus Status { get; set; } = VoiceCaptureStatus.PendingUpload;
    public string? FailureReason { get; set; }

    public Transcript? Transcript { get; set; }
}
