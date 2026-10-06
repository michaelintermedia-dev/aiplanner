using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Attachments;

/// <summary>
/// What may be attached and how big (pure, unit-tested). The type comes from
/// the file name's extension only - a client's Content-Type is never trusted,
/// and nothing that a browser would run (HTML, SVG, scripts) is accepted.
/// </summary>
public static class AttachmentRules
{
    /// <summary>One file (photos are shrunk on the device first, so this is for documents).</summary>
    public const long MaxFileBytes = 20L * 1024 * 1024;
    /// <summary>Everything one user has attached - keeps a small server's disk from filling up.</summary>
    public const long QuotaBytes = 1024L * 1024 * 1024;
    public const int MaxPerItem = 50;
    public const int MaxFileNameLength = 120;

    private static readonly Dictionary<string, (string ContentType, AttachmentKind Kind)> Types =
        new(StringComparer.OrdinalIgnoreCase)
        {
            [".jpg"] = ("image/jpeg", AttachmentKind.Image),
            [".jpeg"] = ("image/jpeg", AttachmentKind.Image),
            [".png"] = ("image/png", AttachmentKind.Image),
            [".webp"] = ("image/webp", AttachmentKind.Image),
            [".gif"] = ("image/gif", AttachmentKind.Image),
            // iPhone photos straight from Files: most browsers can't show them, so they're files.
            [".heic"] = ("image/heic", AttachmentKind.File),
            [".heif"] = ("image/heif", AttachmentKind.File),
            [".pdf"] = ("application/pdf", AttachmentKind.File),
            [".txt"] = ("text/plain", AttachmentKind.File),
            [".csv"] = ("text/csv", AttachmentKind.File),
            [".rtf"] = ("application/rtf", AttachmentKind.File),
            [".doc"] = ("application/msword", AttachmentKind.File),
            [".docx"] = ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", AttachmentKind.File),
            [".xls"] = ("application/vnd.ms-excel", AttachmentKind.File),
            [".xlsx"] = ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", AttachmentKind.File),
            [".ppt"] = ("application/vnd.ms-powerpoint", AttachmentKind.File),
            [".pptx"] = ("application/vnd.openxmlformats-officedocument.presentationml.presentation", AttachmentKind.File),
            [".odt"] = ("application/vnd.oasis.opendocument.text", AttachmentKind.File),
            [".ods"] = ("application/vnd.oasis.opendocument.spreadsheet", AttachmentKind.File),
            [".odp"] = ("application/vnd.oasis.opendocument.presentation", AttachmentKind.File),
        };

    /// <summary>The extensions that can be attached, e.g. for an error message.</summary>
    public static IReadOnlyCollection<string> Extensions => Types.Keys;

    /// <summary>The stored type and kind for a file name, or null when that kind of file isn't allowed.</summary>
    public static (string ContentType, AttachmentKind Kind)? Classify(string fileName)
    {
        var ext = Path.GetExtension(CleanFileName(fileName));
        return Types.TryGetValue(ext, out var type) ? type : null;
    }

    /// <summary>
    /// The name to keep: no folders (some browsers send a full path), no
    /// control or path characters, at most <see cref="MaxFileNameLength"/>
    /// characters with the extension kept.
    /// </summary>
    public static string CleanFileName(string fileName)
    {
        var name = fileName.Replace('\\', '/');
        name = name[(name.LastIndexOf('/') + 1)..];
        name = new string(name.Where(c => !char.IsControl(c) && c is not ('"' or '<' or '>' or ':' or '|' or '?' or '*')).ToArray()).Trim();
        if (name.Length == 0 || name.StartsWith('.') && Path.GetFileNameWithoutExtension(name).Length == 0)
        {
            name = "file" + name;
        }
        if (name.Length > MaxFileNameLength)
        {
            var ext = Path.GetExtension(name);
            if (ext.Length > 10) ext = string.Empty;
            name = name[..(MaxFileNameLength - ext.Length)].TrimEnd() + ext;
        }
        return name;
    }

    /// <summary>Why this upload can't be added, or null when it can.</summary>
    public static string? Problem(string fileName, long sizeBytes, long usedBytes, int countOnItem)
    {
        if (Classify(fileName) is null)
            return "This kind of file can't be attached. Use a photo (JPG, PNG, WebP, GIF), PDF, text or Office document.";
        if (sizeBytes <= 0)
            return "The file is empty.";
        if (sizeBytes > MaxFileBytes)
            return $"The file is too big (the limit is {MaxFileBytes / (1024 * 1024)} MB).";
        if (countOnItem >= MaxPerItem)
            return $"An item can have at most {MaxPerItem} attachments.";
        if (usedBytes + sizeBytes > QuotaBytes)
            return "Your storage is full. Remove some attachments first.";
        return null;
    }
}
