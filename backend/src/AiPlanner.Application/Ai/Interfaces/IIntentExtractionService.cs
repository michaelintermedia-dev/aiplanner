namespace AiPlanner.Application.Ai.Interfaces;

/// <summary>
/// Turns natural language into a title, a summary and proposed items (spec
/// sections 16-20). One call produces all three, which is cheaper and more
/// consistent than separate title/summary/extraction calls.
///
/// The result is untrusted provider output: callers must pass it through
/// <see cref="Services.ExtractionNormalizer"/> before storing or showing it.
/// </summary>
public interface IIntentExtractionService
{
    /// <exception cref="Common.Exceptions.AiProviderException">The provider failed or returned unusable output.</exception>
    Task<RawExtraction> ExtractAsync(ExtractionContext context, CancellationToken ct = default);
}

/// <param name="Text">What the user typed or said.</param>
/// <param name="LocalNow">The current wall-clock time in the user's timezone - relative dates resolve against this.</param>
/// <param name="TimeZoneId">The user's IANA timezone, e.g. "Europe/Moscow".</param>
/// <param name="Locale">The user's locale, e.g. "en-US".</param>
public record ExtractionContext(string Text, DateTime LocalNow, string TimeZoneId, string Locale);

/// <summary>What the provider returned, before validation.</summary>
public record RawExtraction(
    string? Title,
    string? Summary,
    IReadOnlyList<RawExtractedItem> Items,
    string RawResponseJson,
    string ProviderName,
    string ModelName);

/// <summary>
/// One proposed item as the provider described it. Dates/times are wall-clock
/// values in the user's timezone ("yyyy-MM-dd", "HH:mm"), never UTC - the
/// backend does the conversion.
/// </summary>
public record RawExtractedItem(
    string? Intent,
    string? Title,
    string? Summary,
    string? Description,
    string? Date,
    string? Time,
    string? EndTime,
    string? Location,
    string? Priority,
    int? ReminderMinutesBefore,
    string? Recurrence,
    string? Clarification,
    double? Confidence);
