using System.Text.Json.Nodes;
using AiPlanner.Application.Ai.Interfaces;

namespace AiPlanner.Infrastructure.Ai;

/// <summary>An attached file as a Chat Completions content part: pictures and PDFs as they are, documents as text.</summary>
internal static class OpenAiMediaParts
{
    /// <summary>The app's language (User.Locale) by name, for the AI.</summary>
    public static string AppLanguage(string locale) => locale.Split('-', '_')[0].ToLowerInvariant() switch
    {
        "ru" => "Russian",
        "he" or "iw" => "Hebrew",
        "en" => "English",
        _ => $"the language of the locale \"{locale}\"",
    };

    public static JsonObject Part(MediaInput m) => m.Kind switch
    {
        MediaInputKind.Image => new JsonObject
        {
            ["type"] = "image_url",
            ["image_url"] = new JsonObject { ["url"] = $"data:{m.MimeType};base64,{Convert.ToBase64String(m.Data!)}" },
        },
        MediaInputKind.Pdf => new JsonObject
        {
            ["type"] = "file",
            ["file"] = new JsonObject { ["filename"] = m.FileName, ["file_data"] = $"data:application/pdf;base64,{Convert.ToBase64String(m.Data!)}" },
        },
        _ => new JsonObject { ["type"] = "text", ["text"] = $"Attached document «{m.FileName}»:\n{m.Text}" },
    };
}
