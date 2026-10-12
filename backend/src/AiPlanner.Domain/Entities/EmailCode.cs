using AiPlanner.Domain.Enums;

namespace AiPlanner.Domain.Entities;

/// <summary>
/// A 6-digit code sent by email - to confirm the address, or to reset the
/// password (2026-10-12, production prep). Only its hash is stored; it works
/// once, for a short time, with a few tries.
/// </summary>
public class EmailCode
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public EmailCodePurpose Purpose { get; set; }
    public string CodeHash { get; set; } = default!;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public int Attempts { get; set; }
    public DateTime? UsedAtUtc { get; set; }
}
