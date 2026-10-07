namespace AiPlanner.Application.Captures.DTOs;

/// <summary>
/// One capture (typed or spoken) with what the AI understood (spec sections
/// 18-21). <see cref="InputText"/> is always the original words - the typed
/// text or the full transcript - and is never replaced by the summary.
/// </summary>
public record CaptureDto(
    Guid Id,
    string Source, // "Text" | "Voice"
    string Title,
    string? Summary,
    string InputText,
    string? LanguageCode,
    int AudioParts, // playable recording segments (0 = text capture, or recording deleted)
    DateTime CreatedAtUtc,
    IReadOnlyList<CaptureItemDto> Items,
    IReadOnlyList<int>? AudioPartDurationsMs = null, // per part, to place item snippets across parts
    bool AutoSaved = false); // "Save right away": already saved - show what it became, no review
