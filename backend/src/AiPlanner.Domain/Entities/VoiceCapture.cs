using AiPlanner.Domain.Common;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Domain.Entities;

public class VoiceCapture : BaseEntity
{
    public string AudioStorageKey { get; set; } = default!;
    public string? MimeType { get; set; }
    public int? DurationSeconds { get; set; }
    public VoiceCaptureStatus Status { get; set; } = VoiceCaptureStatus.PendingUpload;
    public string? FailureReason { get; set; }

    public Transcript? Transcript { get; set; }
}
