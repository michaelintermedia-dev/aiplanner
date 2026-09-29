using AiPlanner.Domain.Common;

namespace AiPlanner.Domain.Entities;

public class Tag : BaseEntity
{
    public string Name { get; set; } = default!;
    public string? ColorHex { get; set; }

    public ICollection<TaskTag> TaskTags { get; set; } = new List<TaskTag>();
}
