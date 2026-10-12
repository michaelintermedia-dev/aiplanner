namespace AiPlanner.Application.Common.Interfaces;

/// <summary>Who may see the operator's pages (the AI cost report) - Admin:Emails in configuration.</summary>
public interface IAdminPolicy
{
    bool IsAdmin(string email);
}
