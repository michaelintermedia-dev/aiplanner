using AiPlanner.Domain.Common;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Domain.Entities;

public class RecurrenceRule : BaseEntity
{
    public RecurrenceFrequency Frequency { get; set; }
    public int Interval { get; set; } = 1;
    public string? ByDay { get; set; }
    public int? ByMonthDay { get; set; }
    public DateTime? EndsOnUtc { get; set; }
    public int? MaxOccurrences { get; set; }
    public string? CustomRuleExpression { get; set; }
}
