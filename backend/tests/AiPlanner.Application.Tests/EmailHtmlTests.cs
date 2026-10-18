using AiPlanner.Application.Auth.Services;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class EmailHtmlTests
{
    [Fact]
    public void The_code_is_set_large_once_and_the_text_is_escaped()
    {
        var html = EmailHtml.From("Your code: 123456", "Your code is 123456.\nIt expires in 15 minutes. <b>not html</b>");
        html.Should().Contain("letter-spacing:8px").And.Contain(">123456</p>");
        System.Text.RegularExpressions.Regex.Matches(html, "letter-spacing:8px").Should().HaveCount(1);
        html.Should().Contain("&lt;b&gt;not html&lt;/b&gt;").And.NotContain("<b>not html</b>");
        html.Should().Contain(EmailHtml.LogoUrl).And.Contain("dir=\"ltr\"");
    }

    [Fact]
    public void Hebrew_and_Arabic_are_right_to_left()
    {
        EmailHtml.From("קוד", "הקוד שלך הוא 123456.").Should().Contain("dir=\"rtl\"").And.Contain("text-align:right");
        EmailHtml.From("رمز", "رمزك هو 123456.").Should().Contain("dir=\"rtl\"");
    }
}
