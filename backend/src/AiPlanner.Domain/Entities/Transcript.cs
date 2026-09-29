using AiPlanner.Domain.Common;

namespace AiPlanner.Domain.Entities;

public class Transcript : BaseEntity
{
    public Guid VoiceCaptureId { get; set; }
    public VoiceCapture VoiceCapture { get; set; } = default!;
    public string Text { get; set; } = default!;
    public string? LanguageCode { get; set; }
    public double? ConfidenceScore { get; set; }
    public string? ProviderName { get; set; }

    public AIExtraction? AiExtraction { get; set; }
}
