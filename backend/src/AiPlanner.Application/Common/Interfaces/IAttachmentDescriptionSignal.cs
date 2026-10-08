namespace AiPlanner.Application.Common.Interfaces;

/// <summary>
/// Wakes the background job that describes attachments (AttachmentDescriber)
/// at once - after an upload, or when the user lets the AI read their files -
/// instead of waiting for its next once-a-minute check.
/// </summary>
public interface IAttachmentDescriptionSignal
{
    void Wake();
}
