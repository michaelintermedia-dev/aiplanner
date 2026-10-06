namespace AiPlanner.Application.Common.Interfaces;

/// <summary>
/// Who may create an account. In production sign-up is by invitation (an
/// allow-list), so strangers can't sign up and spend the AI budget.
/// </summary>
public interface IRegistrationPolicy
{
    /// <param name="email">Already trimmed and lower-cased.</param>
    bool IsAllowed(string email);
}
