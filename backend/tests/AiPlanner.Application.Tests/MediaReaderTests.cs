using System.IO.Compression;
using System.Text;
using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Ai.Services;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class MediaReaderTests
{
    private static byte[] Zip(params (string Name, string Content)[] parts)
    {
        using var buffer = new MemoryStream();
        using (var zip = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var (name, content) in parts)
            {
                using var writer = new StreamWriter(zip.CreateEntry(name).Open());
                writer.Write(content);
            }
        }
        return buffer.ToArray();
    }

    [Fact]
    public void Pictures_and_pdfs_go_as_they_are()
    {
        var (media, skipped) = MediaReader.Prepare([("flyer.JPG", [1, 2, 3]), ("bill.pdf", [4, 5])]);
        media.Select(m => (m.Kind, m.MimeType)).Should().Equal((MediaInputKind.Image, "image/jpeg"), (MediaInputKind.Pdf, "application/pdf"));
        media[0].Data.Should().Equal(1, 2, 3);
        skipped.Should().BeEmpty();
    }

    [Fact]
    public void A_word_document_becomes_its_text_one_paragraph_a_line()
    {
        var docx = Zip(("word/document.xml",
            """<w:document xmlns:w="w"><w:body><w:p><w:r><w:t>Lease ends</w:t></w:r><w:r><w:t xml:space="preserve"> on 1 March</w:t></w:r></w:p><w:p><w:r><w:t>Rent: 1200</w:t></w:r></w:p></w:body></w:document>"""));
        var (media, _) = MediaReader.Prepare([("lease.docx", docx)]);
        media.Single().Kind.Should().Be(MediaInputKind.Text);
        media.Single().Text.Should().Be("Lease ends on 1 March\nRent: 1200");
    }

    [Fact]
    public void Slides_are_read_in_order()
    {
        var pptx = Zip(
            ("ppt/slides/slide10.xml", """<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:t>Ten</a:t></a:p></p:sld>"""),
            ("ppt/slides/slide2.xml", """<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:t>Two</a:t></a:p></p:sld>"""));
        MediaReader.Prepare([("deck.pptx", pptx)]).Media.Single().Text.Should().Be("Two\nTen");
    }

    [Fact]
    public void Plain_text_is_tidied_and_cut_when_long()
    {
        var text = "a  b\r\n\r\n\r\nc" + new string('x', MediaReader.MaxTextChars);
        var read = MediaReader.Prepare([("notes.txt", Encoding.UTF8.GetBytes(text))]).Media.Single().Text!;
        read.Should().StartWith("a b\nc");
        read.Length.Should().BeLessThanOrEqualTo(MediaReader.MaxTextChars + 2);
    }

    [Fact]
    public void What_it_cant_read_is_left_out()
    {
        var (media, skipped) = MediaReader.Prepare([
            ("old.doc", [1]), ("photo.heic", [1]), ("broken.docx", [1, 2, 3]), ("empty.png", []),
            ("huge.pdf", new byte[MediaReader.MaxPdfBytes + 1]),
        ]);
        media.Should().BeEmpty();
        skipped.Should().Equal("old.doc", "photo.heic", "broken.docx", "empty.png", "huge.pdf");
    }

    [Fact]
    public void At_most_ten_files_are_read()
    {
        var files = Enumerable.Range(1, 12).Select(i => ($"p{i}.png", new byte[] { 1 }));
        var (media, skipped) = MediaReader.Prepare(files);
        media.Should().HaveCount(MediaReader.MaxFiles);
        skipped.Should().Equal("p11.png", "p12.png");
    }
}

public class MediaTitlesTests
{
    [Fact]
    public void The_kind_of_file_comes_first_in_the_users_language()
    {
        var en = ClarificationTexts.English;
        MediaTitles.Prefix("Jazz Night", MediaTitles.Label([MediaInputKind.Image, MediaInputKind.Image], en)).Should().Be("Photo: Jazz Night");
        MediaTitles.Prefix("Electricity bill", MediaTitles.Label([MediaInputKind.Pdf], en)).Should().Be("PDF: Electricity bill");
        MediaTitles.Label([MediaInputKind.Text], ClarificationTexts.Russian).Should().Be("Документ");
        MediaTitles.Label([MediaInputKind.Image, MediaInputKind.Pdf], en).Should().Be("Files");
    }

    [Fact]
    public void A_title_that_already_says_it_is_left_alone()
    {
        MediaTitles.Prefix("Photo: Jazz Night flyer", "Photo").Should().Be("Photo: Jazz Night flyer");
        MediaTitles.Prefix(new string('x', 400), "Photo", 300).Should().HaveLength(300);
    }
}
