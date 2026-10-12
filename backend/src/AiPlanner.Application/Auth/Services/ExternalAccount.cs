namespace AiPlanner.Application.Auth.Services;

public enum ExternalAccountAction
{
    /// <summary>This Google/Apple account is already linked: sign in as its user.</summary>
    UseLinked,

    /// <summary>An account with the same email exists and the provider vouches for the email: link it and sign in.</summary>
    LinkExisting,

    /// <summary>Nobody has this email yet: a new account (no password), linked.</summary>
    CreateNew,

    /// <summary>The email is taken but the provider doesn't vouch for it - linking would let anyone take over that account.</summary>
    RefuseUnverifiedEmail,

    /// <summary>No link and no email to make an account with.</summary>
    RefuseNoEmail,
}

/// <summary>Which account a Google/Apple sign-in becomes (pure - unit tested).</summary>
public static class ExternalAccount
{
    public static ExternalAccountAction Decide(bool linked, string? email, bool emailVerified, bool emailTaken)
    {
        if (linked) return ExternalAccountAction.UseLinked;
        if (string.IsNullOrWhiteSpace(email)) return ExternalAccountAction.RefuseNoEmail;
        if (emailTaken) return emailVerified ? ExternalAccountAction.LinkExisting : ExternalAccountAction.RefuseUnverifiedEmail;
        return ExternalAccountAction.CreateNew;
    }

    /// <summary>A name for a new account: what the user typed, else the provider's, else the email's first part.</summary>
    public static string NameFor(string? typed, string? fromProvider, string email)
    {
        var name = !string.IsNullOrWhiteSpace(typed) ? typed : !string.IsNullOrWhiteSpace(fromProvider) ? fromProvider : email.Split('@')[0];
        name = name.Trim();
        return name.Length > 100 ? name[..100] : name;
    }
}
