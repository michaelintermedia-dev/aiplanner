using AiPlanner.Application.Captures.DTOs;
using AiPlanner.Application.Common.Models;

namespace AiPlanner.Application.Captures.Interfaces;

/// <summary>
/// Quick capture: text or voice in, AI-proposed items out, saved only after
/// the user confirms (spec sections 14-21).
/// </summary>
public interface ICaptureService
{
    /// <param name="media">Photos/documents the AI reads with the words; with them the text may be empty.</param>
    Task<Result<CaptureDto>> CaptureTextAsync(CaptureTextRequest request, CancellationToken ct = default, IReadOnlyList<MediaUpload>? media = null);

    /// <summary>
    /// Stores the recording (one or more segments, in speaking order), transcribes
    /// each segment, joins the text, then extracts items from it.
    /// </summary>
    /// <param name="saveNow">The smart Save button (see CaptureTextRequest.SaveNow).</param>
    Task<Result<CaptureDto>> CaptureVoiceAsync(IReadOnlyList<AudioSegment> segments, CancellationToken ct = default, bool saveNow = false, IReadOnlyList<MediaUpload>? media = null);

    /// <param name="pendingDays">Only captures from the last N days with proposals still waiting for review.</param>
    Task<IReadOnlyList<CaptureSummaryDto>> GetListAsync(int take, CancellationToken ct = default, int? pendingDays = null);

    /// <summary>Rejects every proposal still waiting for review (the "Discard all" of unsaved reviews).</summary>
    Task<int> DiscardPendingAsync(CancellationToken ct = default);

    Task<Result<CaptureDto>> GetByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>The capture to add voice or text to for an item: its source, or a new empty one for an item made by hand.</summary>
    Task<Result<CaptureDto>> ForItemAsync(string itemType, Guid itemId, CancellationToken ct = default);

    /// <summary>Creates the accepted items as real tasks/appointments/notes, all in one transaction.</summary>
    /// <summary>
    /// Adds to a capture after the fact ("continue talking"): new audio parts are
    /// appended to the recording, the new words to the transcript, and what the
    /// AI makes of them is added as new items to review.
    /// </summary>
    Task<Result<CaptureDto>> ContinueAsync(Guid id, ContinueCaptureRequest request, CancellationToken ct = default);

    Task<Result<CaptureDto>> ConfirmAsync(Guid id, ConfirmCaptureRequest request, CancellationToken ct = default);

    /// <summary>Opens segment <paramref name="part"/> of the original recording, or fails if there is none.</summary>
    Task<Result<(Stream Content, string MimeType)>> OpenAudioAsync(Guid id, int part = 0, CancellationToken ct = default);

    /// <summary>Deletes the recording but keeps the transcript and items (spec sections 40-41).</summary>
    Task<Result> DeleteAudioAsync(Guid id, CancellationToken ct = default);
}
