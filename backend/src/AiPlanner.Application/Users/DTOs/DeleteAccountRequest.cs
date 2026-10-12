namespace AiPlanner.Application.Users.DTOs;

/// <summary>Deleting the account: the user types the account's email to confirm.</summary>
public record DeleteAccountRequest(string ConfirmEmail);
