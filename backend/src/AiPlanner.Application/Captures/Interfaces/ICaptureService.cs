using AiPlanner.Application.Captures.DTOs;
using AiPlanner.Application.Common.Models;

namespace AiPlanner.Application.Captures.Interfaces;

/// <summary>
/// Quick capture: text or voice in, AI-proposed items out, saved only after
/// the user confirms (spec sections 14-21).
/// </summary>
public interface ICaptureService
{
    Task<Result<CaptureDto>> CaptureTextAsync(CaptureTextRequest request, CancellationToken ct = default);

    /// <summary>Stores the recording, transcribes it, then extracts items from the transcript.</summary>
    Task<Result<CaptureDto>> CaptureVoiceAsync(Stream audio, string fileName, string? mimeType, CancellationToken ct = default);

    Task<IReadOnlyList<CaptureSummaryDto>> GetListAsync(int take, CancellationToken ct = default);

    Task<Result<CaptureDto>> GetByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>Creates the accepted items as real tasks/appointments/notes, all in one transaction.</summary>
    Task<Result<CaptureDto>> ConfirmAsync(Guid id, ConfirmCaptureRequest request, CancellationToken ct = default);

    /// <summary>Opens the original recording, or fails if there is none (text capture, or already deleted).</summary>
    Task<Result<(Stream Content, string MimeType)>> OpenAudioAsync(Guid id, CancellationToken ct = default);

    /// <summary>Deletes the recording but keeps the transcript and items (spec sections 40-41).</summary>
    Task<Result> DeleteAudioAsync(Guid id, CancellationToken ct = default);
}
