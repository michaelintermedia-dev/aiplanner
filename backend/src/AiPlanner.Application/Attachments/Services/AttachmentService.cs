using AiPlanner.Application.Attachments.DTOs;
using AiPlanner.Application.Attachments.Interfaces;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Models;
using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Attachments.Services;

/// <summary>
/// Photos and documents on items. Files go to IFileStorageService under the
/// user's folder (never the database); the row keeps the name, the type the
/// server worked out from the extension, and the size. Only the item's owner
/// can see, add or remove them.
/// </summary>
public class AttachmentService : IAttachmentService
{
    private const string ItemNotFound = "Item not found.";
    private const string NotFound = "Attachment not found.";

    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IFileStorageService _storage;
    private readonly IAttachmentDescriptionSignal _describe;

    public AttachmentService(IApplicationDbContext db, ICurrentUserService currentUser, IFileStorageService storage, IAttachmentDescriptionSignal describe)
    {
        _describe = describe;
        _db = db;
        _currentUser = currentUser;
        _storage = storage;
    }

    public async Task<Result<IReadOnlyList<AttachmentDto>>> ListAsync(string itemType, Guid itemId, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        if (!await ItemExistsAsync(userId, itemType, itemId, ct))
        {
            return Result<IReadOnlyList<AttachmentDto>>.Failure(ItemNotFound);
        }
        var rows = await _db.Attachments.AsNoTracking()
            .Where(a => a.UserId == userId && a.ItemType == itemType && a.ItemId == itemId)
            .OrderBy(a => a.CreatedAtUtc)
            .ToListAsync(ct);
        return Result<IReadOnlyList<AttachmentDto>>.Success(rows.Select(ToDto).ToList());
    }

    public async Task<Result<AttachmentDto>> AddAsync(string itemType, Guid itemId, string fileName, long sizeBytes, Stream content, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        if (!await ItemExistsAsync(userId, itemType, itemId, ct))
        {
            return Result<AttachmentDto>.Failure(ItemNotFound);
        }

        var name = AttachmentRules.CleanFileName(fileName);
        var used = await _db.Attachments.Where(a => a.UserId == userId).SumAsync(a => (long?)a.SizeBytes, ct) ?? 0;
        var count = await _db.Attachments.CountAsync(a => a.UserId == userId && a.ItemType == itemType && a.ItemId == itemId, ct);
        if (AttachmentRules.Problem(name, sizeBytes, used, count) is { } problem)
        {
            return Result<AttachmentDto>.Failure(problem);
        }

        var (contentType, kind) = AttachmentRules.Classify(name)!.Value;
        var attachment = new Attachment
        {
            UserId = userId,
            ItemType = itemType,
            ItemId = itemId,
            Kind = kind,
            FileName = name,
            ContentType = contentType,
            SizeBytes = sizeBytes,
        };
        attachment.StorageKey = $"{userId}/attachments/{attachment.Id}{Path.GetExtension(name).ToLowerInvariant()}";
        attachment.RefreshSearchText();

        await _storage.SaveAsync(attachment.StorageKey, content, ct);
        try
        {
            _db.Attachments.Add(attachment);
            await _db.SaveChangesAsync(ct);
        }
        catch
        {
            await _storage.DeleteAsync(attachment.StorageKey, CancellationToken.None);
            throw;
        }
        _describe.Wake(); // described in seconds, not at the next check
        return Result<AttachmentDto>.Success(ToDto(attachment));
    }

    public async Task<Result<AttachmentContent>> OpenAsync(Guid id, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var attachment = await _db.Attachments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId, ct);
        if (attachment is null)
        {
            return Result<AttachmentContent>.Failure(NotFound);
        }
        var stream = await _storage.OpenReadAsync(attachment.StorageKey, ct);
        return stream is null
            ? Result<AttachmentContent>.Failure(NotFound)
            : Result<AttachmentContent>.Success(new AttachmentContent(stream, attachment.ContentType, attachment.FileName, attachment.Kind));
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var attachment = await _db.Attachments.FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId, ct);
        if (attachment is null)
        {
            return Result.Failure(NotFound);
        }
        // The row stays as a deleted marker (sync); the file goes now - there's no undo for it.
        attachment.IsDeleted = true;
        await _db.SaveChangesAsync(ct);
        await _storage.DeleteAsync(attachment.StorageKey, ct);
        return Result.Success();
    }

    private async Task<bool> ItemExistsAsync(Guid userId, string itemType, Guid itemId, CancellationToken ct) => itemType switch
    {
        "Task" => await _db.TaskItems.AnyAsync(x => x.Id == itemId && x.UserId == userId, ct),
        "Appointment" => await _db.Appointments.AnyAsync(x => x.Id == itemId && x.UserId == userId, ct),
        "Note" => await _db.Notes.AnyAsync(x => x.Id == itemId && x.UserId == userId, ct),
        _ => false,
    };

    private static AttachmentDto ToDto(Attachment a) =>
        new(a.Id, a.Kind, a.FileName, a.ContentType, a.SizeBytes, a.CreatedAtUtc, string.IsNullOrEmpty(a.Description) ? null : a.Description);

    private Guid RequireUserId() => _currentUser.UserId ?? throw new UnauthorizedAccessException("No authenticated user.");
}
