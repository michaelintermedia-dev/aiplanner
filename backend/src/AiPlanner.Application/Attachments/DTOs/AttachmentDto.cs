using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Attachments.DTOs;

/// <summary>One of an item's attachments; the file is at GET /api/attachments/{Id}/content.</summary>
public record AttachmentDto(
    Guid Id,
    AttachmentKind Kind,
    string FileName,
    string ContentType,
    long SizeBytes,
    DateTime CreatedAtUtc,
    string? Description = null); // what the AI says it shows (null/empty: not described)
