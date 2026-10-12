using System.Security.Cryptography;
using System.Text;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Auth.Services;

/// <summary>One-time email codes (pure - unit tested): 6 digits, stored hashed, short-lived, few tries.</summary>
public static class EmailCodes
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan ResendAfter = TimeSpan.FromSeconds(60);
    public const int MaxAttempts = 5;

    public static string NewCode() => RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

    /// <summary>The stored form: tied to the user and the purpose, so a code is useless anywhere else.</summary>
    public static string Hash(Guid userId, EmailCodePurpose purpose, string code) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{userId:N}|{(int)purpose}|{Normalize(code)}")));

    /// <summary>"123 456", "123-456" -> "123456".</summary>
    public static string Normalize(string? code) => new((code ?? "").Where(char.IsDigit).ToArray());

    public static bool Matches(Guid userId, EmailCodePurpose purpose, string typed, string storedHash) =>
        Normalize(typed).Length == 6 && CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(Hash(userId, purpose, typed)), Encoding.ASCII.GetBytes(storedHash));
}
