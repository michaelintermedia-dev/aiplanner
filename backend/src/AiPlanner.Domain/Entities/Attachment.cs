using AiPlanner.Domain.Common;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Domain.Entities;

/// <summary>
/// A photo, document or voice clip on one item (task, appointment or note) -
/// the item's "Media". The file itself lives in IFileStorageService under
/// <see cref="StorageKey"/>, never in the database. Changing the item's type
/// moves its attachments to the new item.
/// </summary>
public class Attachment : BaseEntity
{
    /// <summary>"Task", "Appointment" or "Note".</summary>
    public string ItemType { get; set; } = string.Empty;
    public Guid ItemId { get; set; }

    public AttachmentKind Kind { get; set; }
    /// <summary>The name it was uploaded with (shown, and used when downloading).</summary>
    public string FileName { get; set; } = string.Empty;
    /// <summary>Worked out by the server from the file's extension - never the client's claim.</summary>
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string StorageKey { get; set; } = string.Empty;

    /// <summary>
    /// What the AI says it shows - what it is, its key facts and readable text -
    /// so the feed search finds it ("the photo of the wifi password"). Null = not
    /// described yet (AttachmentDescriber, only with the user's OK); "" = nothing
    /// the AI can read (audio, HEIC, old .doc).
    /// </summary>
    public string? Description { get; set; }
    public DateTime? DescribedAtUtc { get; set; }
    /// <summary>Failed tries (the provider was down); given up after AttachmentDescriber.MaxAttempts.</summary>
    public int DescribeAttempts { get; set; }

    /// <summary>
    /// File name + description for the feed search: lower case, letters and
    /// digits only ("Wi-Fi SSID" -> "wifissid"), so a search for "wifi" finds it
    /// however it's written. Set with <see cref="SearchKey"/>.
    /// </summary>
    public string SearchText { get; set; } = string.Empty;

    public static string SearchKey(string? text) =>
        new((text ?? "").ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());

    /// <summary>Recomputes <see cref="SearchText"/> after the name or description changed.</summary>
    public void RefreshSearchText() => SearchText = SearchKey(FileName + " " + Description);
}
