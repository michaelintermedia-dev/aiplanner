namespace AiPlanner.Application.Common.Interfaces;

/// <summary>
/// Sends the app's own emails (codes to confirm an address or reset a password).
/// Not configured = the email features are off (hidden in the apps).
/// </summary>
public interface IEmailSender
{
    bool IsConfigured { get; }

    /// <exception cref="InvalidOperationException">The provider refused or couldn't be reached.</exception>
    Task SendAsync(string to, string subject, string text, CancellationToken ct = default);
}
