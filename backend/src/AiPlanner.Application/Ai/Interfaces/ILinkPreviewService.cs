namespace AiPlanner.Application.Ai.Interfaces;

/// <summary>
/// What a web link is (its page title), looked up so the AI can name an entry
/// that is only a link - something shared from YouTube, a browser... (user's
/// request, 2026-10-12). Implemented in Infrastructure; never throws - a link
/// it can't read comes back without a title.
/// </summary>
public interface ILinkPreviewService
{
    Task<IReadOnlyList<LinkPreview>> PreviewAsync(IReadOnlyList<string> urls, CancellationToken ct = default);
}

/// <param name="Title">The page's title (a YouTube video's name), or null when unknown.</param>
/// <param name="Site">The site's name ("YouTube") when the page says it.</param>
public record LinkPreview(string Url, string? Title, string? Site);
