namespace AiPlanner.Application.Captures.DTOs;

/// <summary>A photo or document sent with a new capture, for the AI to read (it's attached to the item by the client after saving).</summary>
public record MediaUpload(string FileName, byte[] Data);
