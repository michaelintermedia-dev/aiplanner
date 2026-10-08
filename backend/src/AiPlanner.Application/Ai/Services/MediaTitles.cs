using AiPlanner.Application.Ai.Interfaces;

namespace AiPlanner.Application.Ai.Services;

/// <summary>
/// A capture of only files (no words): every title says what kind of file it
/// is first - "Photo: Jazz concert flyer", "PDF: Electricity bill" - so the
/// entry is recognisable as one (user's rule, 2026-10-09). Done here, not left
/// to the AI, so it's always there and in the user's language. Pure, tested.
/// </summary>
public static class MediaTitles
{
    /// <summary>The kind word for these files: Photo / PDF / Document, or Files for a mix.</summary>
    public static string Label(IEnumerable<MediaInputKind> kinds, ClarificationTexts texts)
    {
        var distinct = kinds.Distinct().ToList();
        return distinct.Count != 1 ? texts.MediaFiles : distinct[0] switch
        {
            MediaInputKind.Image => texts.MediaPhoto,
            MediaInputKind.Pdf => texts.MediaPdf,
            _ => texts.MediaDocument,
        };
    }

    /// <summary>"Label: title" - unless it already starts with the label.</summary>
    public static string Prefix(string title, string label, int maxLength = ExtractionNormalizer.MaxTitleLength)
    {
        var trimmed = title.Trim();
        if (trimmed.StartsWith(label, StringComparison.OrdinalIgnoreCase)) return trimmed;
        var prefixed = $"{label}: {trimmed}";
        return prefixed.Length <= maxLength ? prefixed : prefixed[..maxLength].TrimEnd();
    }

    /// <summary>The capture's title and every item's.</summary>
    public static NormalizedExtraction Apply(NormalizedExtraction extraction, string label) => extraction with
    {
        Title = Prefix(extraction.Title, label),
        Items = extraction.Items.Select(i => i with { Title = Prefix(i.Title, label) }).ToList(),
    };
}
