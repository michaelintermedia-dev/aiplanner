using AiPlanner.Domain.Common;

namespace AiPlanner.Domain.Entities;

public class AIExtraction : BaseEntity
{
    public Guid? TranscriptId { get; set; }
    public Transcript? Transcript { get; set; }

    public string? RawInputText { get; set; }
    public string RawResponseJson { get; set; } = default!;
    public string? ProviderName { get; set; } = "OpenAI";
    public string? ModelName { get; set; }
    public DateTime ProcessedAtUtc { get; set; } = DateTime.UtcNow;

    public ICollection<AIExtractionItem> Items { get; set; } = new List<AIExtractionItem>();
}
