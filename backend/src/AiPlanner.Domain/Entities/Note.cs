using AiPlanner.Domain.Common;

namespace AiPlanner.Domain.Entities;

public class Note : BaseEntity
{
    public string? Title { get; set; }
    public string Content { get; set; } = default!;
    public string? AiSummary { get; set; }

    public Guid? SourceAiExtractionId { get; set; }
    public AIExtraction? SourceAiExtraction { get; set; }
}
