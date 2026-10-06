using AiPlanner.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace AiPlanner.Infrastructure.Services;

/// <summary>
/// Auth:AllowedEmails - the emails that may sign up, separated by commas,
/// semicolons or spaces (an env var: Auth__AllowedEmails="a@x.com,b@y.com").
/// Empty or missing: anyone may (local development).
/// </summary>
public class ConfigRegistrationPolicy : IRegistrationPolicy
{
    private readonly HashSet<string> _allowed;

    public ConfigRegistrationPolicy(IConfiguration configuration)
    {
        _allowed = (configuration["Auth:AllowedEmails"] ?? "")
            .Split([',', ';', ' ', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(e => e.ToLowerInvariant())
            .ToHashSet();
    }

    public bool IsAllowed(string email) => _allowed.Count == 0 || _allowed.Contains(email);
}
