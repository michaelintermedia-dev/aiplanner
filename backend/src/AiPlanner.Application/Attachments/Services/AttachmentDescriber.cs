using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Ai.Services;
using AiPlanner.Application.Common.Exceptions;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AiPlanner.Application.Attachments.Services;

/// <summary>
/// Gives every photo and document a description the feed search can find
/// (media step 2, 2026-10-09). Run in the background (AttachmentDescriptionWorker),
/// oldest first, a few at a time - only for users who agreed to their files
/// going to OpenAI (UserSettings.AiReadsMedia, asked once in the capture bar).
/// Turning that on later describes what's already there. Files the AI can't
/// read get "" so they're not tried again; a provider failure is retried a
/// few times. Logs counts only, never what a file says.
/// </summary>
public class AttachmentDescriber
{
    public const int Batch = 10;
    public const int MaxAttempts = 3;
    public const int MaxLength = 1500;

    private readonly IApplicationDbContext _db;
    private readonly IFileStorageService _storage;
    private readonly IMediaDescriptionService _ai;
    private readonly IDateTime _clock;
    private readonly ILogger<AttachmentDescriber> _logger;

    public AttachmentDescriber(
        IApplicationDbContext db, IFileStorageService storage, IMediaDescriptionService ai, IDateTime clock, ILogger<AttachmentDescriber> logger)
    {
        _db = db;
        _storage = storage;
        _ai = ai;
        _clock = clock;
        _logger = logger;
    }

    /// <summary>Describes up to <see cref="Batch"/> waiting attachments; returns how many it looked at.</summary>
    public async Task<int> RunAsync(CancellationToken ct = default)
    {
        var due = await (
                from a in _db.Attachments
                where a.Description == null && a.DescribeAttempts < MaxAttempts && a.Kind != AttachmentKind.Audio
                join s in _db.UserSettings on a.UserId equals s.UserId
                where s.AiReadsMedia == true
                join u in _db.Users on a.UserId equals u.Id
                orderby a.CreatedAtUtc
                select new { Attachment = a, u.Locale })
            .Take(Batch)
            .ToListAsync(ct);

        var described = 0;
        foreach (var row in due)
        {
            var a = row.Attachment;
            byte[]? bytes = null;
            await using (var stream = await _storage.OpenReadAsync(a.StorageKey, ct))
            {
                if (stream is not null)
                {
                    using var buffer = new MemoryStream();
                    await stream.CopyToAsync(buffer, ct);
                    bytes = buffer.ToArray();
                }
            }
            var media = bytes is null ? null : MediaReader.Prepare([(a.FileName, bytes)]).Media.FirstOrDefault();
            if (media is null)
            {
                a.Description = ""; // nothing the AI can read
            }
            else
            {
                try
                {
                    var text = (await _ai.DescribeAsync(media, row.Locale, ct)).Trim();
                    a.Description = text.Length > MaxLength ? text[..MaxLength] : text;
                    a.DescribedAtUtc = _clock.UtcNow;
                    described++;
                }
                catch (AiProviderException)
                {
                    a.DescribeAttempts++;
                }
            }
            a.RefreshSearchText();
            await _db.SaveChangesAsync(ct);
        }
        if (due.Count > 0)
        {
            _logger.LogInformation("Attachment descriptions: {Described} described, {Looked} looked at", described, due.Count);
        }
        return due.Count;
    }
}
