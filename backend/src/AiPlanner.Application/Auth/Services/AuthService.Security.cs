using AiPlanner.Application.Auth.DTOs;
using AiPlanner.Application.Common.Models;
using AiPlanner.Domain.Entities;
using AiPlanner.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Auth.Services;

/// <summary>
/// Passwords and email codes (production prep, 2026-10-12): change or set the
/// password, sign out everywhere, confirm the email, forgot password. Any
/// password change signs out every other session.
/// </summary>
public partial class AuthService
{
    public const string WrongPassword = "The current password isn't right.";
    public const string WrongCode = "That code isn't right or has expired. Ask for a new one.";

    public bool EmailEnabled => _email.IsConfigured;

    /// <summary>Change the password (current one required) or set one on a Google/Apple-only account.</summary>
    public async Task<Result<AuthResponse>> ChangePasswordAsync(Guid userId, ChangePasswordRequest request, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return Result<AuthResponse>.Failure("Not signed in.");
        if (!string.IsNullOrEmpty(user.PasswordHash) && !_passwordHasher.Verify(request.CurrentPassword ?? "", user.PasswordHash))
        {
            return Result<AuthResponse>.Failure(WrongPassword);
        }
        return Result<AuthResponse>.Success(await SetPasswordAsync(user, request.NewPassword, request.DeviceInfo, ct));
    }

    /// <summary>Every session ends (this one too) - a lost phone, or "it wasn't me".</summary>
    public async Task SignOutEverywhereAsync(Guid userId, CancellationToken ct = default) =>
        await RevokeAllAsync(userId, ct);

    /// <summary>Sends a confirmation code to the account's email (not again within a minute).</summary>
    public async Task<Result> SendVerificationAsync(Guid userId, CancellationToken ct = default)
    {
        if (!_email.IsConfigured) return Result.Failure("Email isn't set up on this server.");
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return Result.Failure("Not signed in.");
        if (user.EmailConfirmed) return Result.Success();
        return await SendCodeAsync(user, EmailCodePurpose.VerifyEmail, ct);
    }

    public async Task<Result> VerifyEmailAsync(Guid userId, string code, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return Result.Failure("Not signed in.");
        if (user.EmailConfirmed) return Result.Success();
        if (!await UseCodeAsync(user.Id, EmailCodePurpose.VerifyEmail, code, ct)) return Result.Failure(WrongCode);
        user.EmailConfirmed = true;
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }

    /// <summary>
    /// "Forgot password?": a reset code to that address. Always looks the same to
    /// the caller - it never tells whether an account exists.
    /// </summary>
    public async Task ForgotPasswordAsync(string email, CancellationToken ct = default)
    {
        if (!_email.IsConfigured) return;
        var address = email.Trim().ToLowerInvariant();
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == address, ct);
        if (user is not null) await SendCodeAsync(user, EmailCodePurpose.ResetPassword, ct);
    }

    /// <summary>A new password with the emailed code: the email is proven, every other session ends, and this device is signed in.</summary>
    public async Task<Result<AuthResponse>> ResetPasswordAsync(ResetPasswordRequest request, CancellationToken ct = default)
    {
        var address = request.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == address, ct);
        if (user is null || !await UseCodeAsync(user.Id, EmailCodePurpose.ResetPassword, request.Code, ct))
        {
            return Result<AuthResponse>.Failure(WrongCode);
        }
        user.EmailConfirmed = true; // the code came to that inbox
        return Result<AuthResponse>.Success(await SetPasswordAsync(user, request.NewPassword, request.DeviceInfo, ct));
    }

    private async Task<AuthResponse> SetPasswordAsync(User user, string newPassword, string? deviceInfo, CancellationToken ct)
    {
        user.PasswordHash = _passwordHasher.Hash(newPassword);
        user.UpdatedAtUtc = _dateTime.UtcNow;
        await RevokeAllAsync(user.Id, ct);
        await _db.SaveChangesAsync(ct);
        return await IssueTokensAsync(user, deviceInfo, ct); // this device stays signed in
    }

    private async Task RevokeAllAsync(Guid userId, CancellationToken ct)
    {
        var now = _dateTime.UtcNow;
        await _db.RefreshTokens.Where(t => t.UserId == userId && t.RevokedAtUtc == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAtUtc, now), ct);
    }

    private async Task<Result> SendCodeAsync(User user, EmailCodePurpose purpose, CancellationToken ct)
    {
        var now = _dateTime.UtcNow;
        var recent = await _db.EmailCodes.AnyAsync(c => c.UserId == user.Id && c.Purpose == purpose && c.CreatedAtUtc > now - EmailCodes.ResendAfter, ct);
        if (recent) return Result.Success(); // one is on its way already
        // Only the newest code of a kind works.
        await _db.EmailCodes.Where(c => c.UserId == user.Id && c.Purpose == purpose && c.UsedAtUtc == null)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.UsedAtUtc, now), ct);

        var code = EmailCodes.NewCode();
        _db.EmailCodes.Add(new EmailCode
        {
            UserId = user.Id,
            Purpose = purpose,
            CodeHash = EmailCodes.Hash(user.Id, purpose, code),
            CreatedAtUtc = now,
            ExpiresAtUtc = now + EmailCodes.Lifetime,
        });
        await _db.SaveChangesAsync(ct);

        var texts = EmailTexts.For(user.Locale);
        var (subject, body) = purpose == EmailCodePurpose.VerifyEmail ? (texts.VerifySubject, texts.VerifyBody) : (texts.ResetSubject, texts.ResetBody);
        try
        {
            await _email.SendAsync(user.Email, EmailTexts.Fill(subject, code), EmailTexts.Fill(body, code), ct);
            return Result.Success();
        }
        catch (InvalidOperationException)
        {
            return Result.Failure("The email couldn't be sent. Try again in a minute.");
        }
    }

    private async Task<bool> UseCodeAsync(Guid userId, EmailCodePurpose purpose, string typed, CancellationToken ct)
    {
        var now = _dateTime.UtcNow;
        var code = await _db.EmailCodes
            .Where(c => c.UserId == userId && c.Purpose == purpose && c.UsedAtUtc == null && c.ExpiresAtUtc > now && c.Attempts < EmailCodes.MaxAttempts)
            .OrderByDescending(c => c.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);
        if (code is null) return false;
        if (!EmailCodes.Matches(userId, purpose, typed, code.CodeHash))
        {
            code.Attempts++;
            await _db.SaveChangesAsync(ct);
            return false;
        }
        code.UsedAtUtc = now;
        await _db.SaveChangesAsync(ct);
        return true;
    }
}
