using System.IO.Compression;
using System.Text;
using System.Xml;
using AiPlanner.Application.Ai.Interfaces;

namespace AiPlanner.Application.Ai.Services;

/// <summary>
/// Photos and documents attached to a capture, made ready for the AI to read
/// (pure, unit-tested). Pictures and PDFs go as they are (the model reads
/// them); Office/OpenDocument files and plain text become text, since the
/// model can't open them. Anything else (old .doc/.xls, HEIC, RTF) is left
/// out - it's still attached to the item, the AI just doesn't read it.
/// </summary>
public static class MediaReader
{
    public const int MaxFiles = 10;
    public const long MaxImageBytes = 10L * 1024 * 1024;
    public const long MaxPdfBytes = 15L * 1024 * 1024;
    /// <summary>Text taken from one document (the start of a long one is what matters).</summary>
    public const int MaxTextChars = 20_000;

    private static readonly Dictionary<string, string> Images = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".png"] = "image/png", [".webp"] = "image/webp", [".gif"] = "image/gif",
    };

    /// <summary>What the AI gets, and the names it couldn't read.</summary>
    public static (IReadOnlyList<MediaInput> Media, IReadOnlyList<string> Skipped) Prepare(IEnumerable<(string FileName, byte[] Data)> files)
    {
        var media = new List<MediaInput>();
        var skipped = new List<string>();
        foreach (var (name, data) in files)
        {
            var read = media.Count < MaxFiles ? Read(name, data) : null;
            if (read is null) skipped.Add(name);
            else media.Add(read);
        }
        return (media, skipped);
    }

    private static MediaInput? Read(string name, byte[] data)
    {
        var ext = Path.GetExtension(name);
        if (data.Length == 0) return null;
        if (Images.TryGetValue(ext, out var mime))
        {
            return data.Length <= MaxImageBytes ? new MediaInput(MediaInputKind.Image, name, mime, data, null) : null;
        }
        if (ext.Equals(".pdf", StringComparison.OrdinalIgnoreCase))
        {
            return data.Length <= MaxPdfBytes ? new MediaInput(MediaInputKind.Pdf, name, "application/pdf", data, null) : null;
        }
        var text = ext.ToLowerInvariant() switch
        {
            ".txt" or ".csv" => Encoding.UTF8.GetString(data),
            ".docx" => FromZip(data, n => n == "word/document.xml", "p"),
            ".pptx" => FromZip(data, n => n.StartsWith("ppt/slides/slide", StringComparison.Ordinal) && n.EndsWith(".xml", StringComparison.Ordinal), "p"),
            ".xlsx" => FromZip(data, n => n == "xl/sharedStrings.xml", "si"),
            ".odt" or ".ods" or ".odp" => FromZip(data, n => n == "content.xml", "p"),
            _ => null,
        };
        text = Tidy(text);
        return string.IsNullOrEmpty(text) ? null : new MediaInput(MediaInputKind.Text, name, "text/plain", null, text);
    }

    /// <summary>
    /// The text of the matching XML parts of a zip-based document: every text
    /// node, with a line break after each <paramref name="paragraph"/> element.
    /// Broken files give null.
    /// </summary>
    private static string? FromZip(byte[] data, Func<string, bool> part, string paragraph)
    {
        try
        {
            using var zip = new ZipArchive(new MemoryStream(data), ZipArchiveMode.Read);
            var text = new StringBuilder();
            // Slides in their order (slide2 before slide10).
            var entries = zip.Entries.Where(e => part(e.FullName))
                .OrderBy(e => e.FullName.Length).ThenBy(e => e.FullName, StringComparer.Ordinal);
            foreach (var entry in entries)
            {
                using var stream = entry.Open();
                using var xml = XmlReader.Create(stream, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null });
                while (xml.Read() && text.Length < MaxTextChars * 2)
                {
                    if (xml.NodeType is XmlNodeType.Text or XmlNodeType.SignificantWhitespace) text.Append(xml.Value);
                    else if (xml.NodeType == XmlNodeType.EndElement && xml.LocalName == paragraph) text.Append('\n');
                    else if (xml.NodeType == XmlNodeType.Element && xml.LocalName is "tab") text.Append(' ');
                }
                text.Append('\n');
            }
            return text.ToString();
        }
        catch (Exception ex) when (ex is InvalidDataException or XmlException or IOException)
        {
            return null;
        }
    }

    /// <summary>No runs of blank lines or spaces, at most MaxTextChars.</summary>
    private static string? Tidy(string? text)
    {
        if (text is null) return null;
        var lines = text.Replace("\r", "").Split('\n')
            .Select(l => string.Join(' ', l.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)))
            .Where(l => l.Length > 0);
        var joined = string.Join('\n', lines);
        return joined.Length > MaxTextChars ? joined[..MaxTextChars] + " …" : joined;
    }
}
