namespace AiPlanner.Domain.Entities;

/// <summary>
/// A Google or Apple account that signs in as this user (user's request,
/// 2026-10-12). The provider's own user id (Subject) is what identifies it -
/// never the email, which can change (and Apple's may be a private relay).
/// </summary>
public class ExternalLogin
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;

    /// <summary>"google" or "apple".</summary>
    public string Provider { get; set; } = default!;

    /// <summary>The provider's id for the person ("sub" in its token).</summary>
    public string Subject { get; set; } = default!;

    /// <summary>The email the provider gave when linked (for support; not used to sign in).</summary>
    public string? Email { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime? LastUsedAtUtc { get; set; }
}
