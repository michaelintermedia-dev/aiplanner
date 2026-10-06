namespace AiPlanner.Domain.Common;

public abstract class BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; }
    /// <summary>Optimistic concurrency: PostgreSQL's xmin (changes on every update).</summary>
    public uint RowVersion { get; set; }
}
