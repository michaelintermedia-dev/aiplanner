using AiPlanner.Application.Auth.DTOs;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class RegisterRequestValidatorTests
{
    private readonly RegisterRequestValidator _validator = new();

    [Fact]
    public void Valid_request_passes()
    {
        var request = new RegisterRequest("jane@example.com", "SuperSecret1", "Jane Doe", "America/New_York");
        _validator.Validate(request).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("", "SuperSecret1", "Jane Doe")]
    [InlineData("not-an-email", "SuperSecret1", "Jane Doe")]
    [InlineData("jane@example.com", "short", "Jane Doe")]
    [InlineData("jane@example.com", "SuperSecret1", "")]
    public void Invalid_request_fails(string email, string password, string displayName)
    {
        var request = new RegisterRequest(email, password, displayName, null);
        _validator.Validate(request).IsValid.Should().BeFalse();
    }
}
