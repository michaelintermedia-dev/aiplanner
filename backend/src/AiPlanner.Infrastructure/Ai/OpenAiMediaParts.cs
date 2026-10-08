using System.Text.Json.Nodes;
using AiPlanner.Application.Ai.Interfaces;

namespace AiPlanner.Infrastructure.Ai;

/// <summary>An attached file as a Chat Completions content part: pictures and PDFs as they are, documents as text.</summary>
internal static class OpenAiMediaParts
{
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
