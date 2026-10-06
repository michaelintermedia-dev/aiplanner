using AiPlanner.Application.Attachments.DTOs;
using AiPlanner.Application.Common.Models;
using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Attachments.Interfaces;

/// <summary>The file of an attachment, ready to send.</summary>
public record AttachmentContent(Stream Content, string ContentType, string FileName, AttachmentKind Kind);

/// <summary>An item's media: photos, documents (and later kept voice clips).</summary>
public interface IAttachmentService
{
    /// <summary>The item's attachments, oldest first. Fails with "Item not found." for someone else's item.</summary>
    Task<Result<IReadOnlyList<AttachmentDto>>> ListAsync(string itemType, Guid itemId, CancellationToken ct = default);

    /// <summary>Stores the file and attaches it to the item (type, size and quota checked).</summary>
    Task<Result<AttachmentDto>> AddAsync(string itemType, Guid itemId, string fileName, long sizeBytes, Stream content, CancellationToken ct = default);

    Task<Result<AttachmentContent>> OpenAsync(Guid id, CancellationToken ct = default);

    /// <summary>Removes the attachment and deletes its file.</summary>
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
}
