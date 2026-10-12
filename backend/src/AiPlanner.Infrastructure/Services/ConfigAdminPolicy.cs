using AiPlanner.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace AiPlanner.Infrastructure.Services;

/// <summary>
/// Admin:Emails - the accounts that may see the operator's pages, separated by
/// commas, semicolons or spaces (an env var: Admin__Emails="me@x.com"). Empty: nobody.
/// </summary>
public class ConfigAdminPolicy : IAdminPolicy
{
    private readonly HashSet<string> _admins;

    public ConfigAdminPolicy(IConfiguration configuration)
    {
        _admins = (configuration["Admin:Emails"] ?? "")
            .Split([',', ';', ' ', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(e => e.ToLowerInvariant())
            .ToHashSet();
    }

    public bool IsAdmin(string email) => _admins.Contains(email.ToLowerInvariant());
}
