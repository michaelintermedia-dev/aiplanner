using AiPlanner.Application.Auth.Services;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class ExternalAccountTests
{
    [Fact]
    public void A_linked_Google_or_Apple_account_signs_in_as_its_user_whatever_the_email()
    {
        ExternalAccount.Decide(linked: true, email: null, emailVerified: false, emailTaken: false).Should().Be(ExternalAccountAction.UseLinked);
        ExternalAccount.Decide(linked: true, email: "a@b.com", emailVerified: false, emailTaken: true).Should().Be(ExternalAccountAction.UseLinked);
    }

    [Fact]
    public void A_verified_email_of_an_existing_account_links_to_it()
    {
        ExternalAccount.Decide(false, "me@x.com", emailVerified: true, emailTaken: true).Should().Be(ExternalAccountAction.LinkExisting);
    }

    [Fact]
    public void An_unverified_email_never_takes_over_an_existing_account()
    {
        ExternalAccount.Decide(false, "me@x.com", emailVerified: false, emailTaken: true).Should().Be(ExternalAccountAction.RefuseUnverifiedEmail);
    }

    [Fact]
    public void A_new_email_makes_a_new_account()
    {
        ExternalAccount.Decide(false, "new@x.com", emailVerified: true, emailTaken: false).Should().Be(ExternalAccountAction.CreateNew);
        ExternalAccount.Decide(false, "new@x.com", emailVerified: false, emailTaken: false).Should().Be(ExternalAccountAction.CreateNew);
    }

    [Fact]
    public void No_link_and_no_email_is_refused()
    {
        ExternalAccount.Decide(false, null, true, false).Should().Be(ExternalAccountAction.RefuseNoEmail);
        ExternalAccount.Decide(false, " ", true, false).Should().Be(ExternalAccountAction.RefuseNoEmail);
    }

    [Theory]
    [InlineData("Anna", "Anna Smith", "a@x.com", "Anna")]
    [InlineData(null, "Anna Smith", "a@x.com", "Anna Smith")]
    [InlineData(" ", null, "anna.s@x.com", "anna.s")]
    public void A_new_account_is_named_by_the_user_then_the_provider_then_the_email(string? typed, string? provider, string email, string expected)
    {
        ExternalAccount.NameFor(typed, provider, email).Should().Be(expected);
    }
}
