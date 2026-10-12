using AiPlanner.Application.Auth.Services;
using AiPlanner.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class EmailCodesTests
{
    private static readonly Guid User = Guid.NewGuid();

    [Fact]
    public void A_new_code_is_six_digits()
    {
        for (var i = 0; i < 50; i++) EmailCodes.NewCode().Should().MatchRegex("^[0-9]{6}$");
    }

    [Fact]
    public void A_code_matches_only_for_its_user_and_purpose()
    {
        var hash = EmailCodes.Hash(User, EmailCodePurpose.VerifyEmail, "123456");
        EmailCodes.Matches(User, EmailCodePurpose.VerifyEmail, "123456", hash).Should().BeTrue();
        EmailCodes.Matches(User, EmailCodePurpose.ResetPassword, "123456", hash).Should().BeFalse();
        EmailCodes.Matches(Guid.NewGuid(), EmailCodePurpose.VerifyEmail, "123456", hash).Should().BeFalse();
        EmailCodes.Matches(User, EmailCodePurpose.VerifyEmail, "123457", hash).Should().BeFalse();
    }

    [Theory]
    [InlineData("123 456")]
    [InlineData("123-456")]
    [InlineData(" 123456 ")]
    public void Spaces_and_dashes_in_a_typed_code_dont_matter(string typed)
    {
        var hash = EmailCodes.Hash(User, EmailCodePurpose.VerifyEmail, "123456");
        EmailCodes.Matches(User, EmailCodePurpose.VerifyEmail, typed, hash).Should().BeTrue();
    }

    [Fact]
    public void A_short_or_empty_code_never_matches()
    {
        var hash = EmailCodes.Hash(User, EmailCodePurpose.VerifyEmail, "");
        EmailCodes.Matches(User, EmailCodePurpose.VerifyEmail, "", hash).Should().BeFalse();
    }

    [Theory]
    [InlineData("en-US")]
    [InlineData("ro-RO")]
    [InlineData("ar")]
    [InlineData("ja-JP")]
    [InlineData("xx")]
    public void Every_email_carries_the_code(string locale)
    {
        var t = EmailTexts.For(locale);
        foreach (var text in new[] { t.VerifySubject, t.VerifyBody, t.ResetSubject, t.ResetBody })
        {
            EmailTexts.Fill(text, "042137").Should().Contain("042137");
        }
    }
}
