namespace AiPlanner.Application.Users.DTOs;

/// <summary>Deleting the account: the user types the account's email to confirm.</summary>
/// <param name="Password">Required when the account has a password (someone holding an unlocked phone can see the email).</param>
public record DeleteAccountRequest(string ConfirmEmail, string? Password = null);
