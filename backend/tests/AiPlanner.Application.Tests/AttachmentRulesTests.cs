using AiPlanner.Application.Attachments;
using AiPlanner.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class AttachmentRulesTests
{
    [Theory]
    [InlineData("photo.JPG", "image/jpeg", AttachmentKind.Image)]
    [InlineData("shot.png", "image/png", AttachmentKind.Image)]
    [InlineData("letter.pdf", "application/pdf", AttachmentKind.File)]
    [InlineData("plan.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", AttachmentKind.File)]
    [InlineData("IMG_0001.HEIC", "image/heic", AttachmentKind.File)]
    public void Classify_KnownTypes(string name, string type, AttachmentKind kind)
    {
        AttachmentRules.Classify(name).Should().Be((type, kind));
    }

    [Theory]
    [InlineData("page.html")]
    [InlineData("logo.svg")]
    [InlineData("run.exe")]
    [InlineData("script.js")]
    [InlineData("noextension")]
    [InlineData("photo.jpg.html")]
    public void Classify_RefusesEverythingElse(string name)
    {
        AttachmentRules.Classify(name).Should().BeNull();
    }

    [Theory]
    [InlineData(@"C:\Users\me\Desktop\scan.pdf", "scan.pdf")]
    [InlineData("../../etc/passwd.txt", "passwd.txt")]
    [InlineData("we\"ird<na>me?.png", "weirdname.png")]
    [InlineData(".pdf", "file.pdf")]
    [InlineData("   ", "file")]
    public void CleanFileName_KeepsOnlyAPlainName(string input, string expected)
    {
        AttachmentRules.CleanFileName(input).Should().Be(expected);
    }

    [Fact]
    public void CleanFileName_ShortensLongNamesKeepingTheExtension()
    {
        var name = AttachmentRules.CleanFileName(new string('a', 300) + ".pdf");
        name.Should().HaveLength(AttachmentRules.MaxFileNameLength).And.EndWith(".pdf");
    }

    [Fact]
    public void Problem_ChecksTypeSizeCountAndQuota()
    {
        AttachmentRules.Problem("a.pdf", 1000, 0, 0).Should().BeNull();
        AttachmentRules.Problem("a.exe", 1000, 0, 0).Should().Contain("can't be attached");
        AttachmentRules.Problem("a.pdf", 0, 0, 0).Should().Contain("empty");
        AttachmentRules.Problem("a.pdf", AttachmentRules.MaxFileBytes + 1, 0, 0).Should().Contain("too big");
        AttachmentRules.Problem("a.pdf", 1000, 0, AttachmentRules.MaxPerItem).Should().Contain("at most");
        AttachmentRules.Problem("a.pdf", 1000, AttachmentRules.QuotaBytes - 999, 0).Should().Contain("storage is full");
    }
}
