namespace AiPlanner.Domain.Enums;

/// <summary>What an item's attachment is - decides how the apps show it.</summary>
public enum AttachmentKind
{
    /// <summary>A photo or picture: shown as a thumbnail, opens full screen.</summary>
    Image = 0,
    /// <summary>A document (PDF, Word, ...): shown by name, opens in another app.</summary>
    File = 1,
    /// <summary>A kept voice clip (saved from what was said about the item).</summary>
    Audio = 2,
}
