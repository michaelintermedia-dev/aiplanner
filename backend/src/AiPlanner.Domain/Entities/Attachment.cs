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
}
