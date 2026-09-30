namespace AiPlanner.Application.Captures.DTOs;

/// <summary>One uploaded audio file of a voice capture, in speaking order.</summary>
public record AudioSegment(Stream Content, string FileName, string? MimeType);
