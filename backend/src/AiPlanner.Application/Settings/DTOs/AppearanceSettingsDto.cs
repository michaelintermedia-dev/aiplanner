namespace AiPlanner.Application.Settings.DTOs;

/// <summary>Settings - Appearance: light/dark and the colour scheme. Kept on the account, so every device follows.</summary>
/// <param name="Theme">"System" (follow the device), "Light" or "Dark".</param>
/// <param name="Skin">One of <see cref="Skins"/> - its colours and its wallpaper.</param>
/// <param name="Wallpaper">Show a wallpaper behind the content (the user's photo if there is one, else the skin's).</param>
/// <param name="WallpaperPhoto">
/// The user's own wallpaper (GET /api/settings/wallpaper/{WallpaperPhoto}), or null. Read-only here:
/// set by uploading (PUT /api/settings/wallpaper), removed with DELETE.
/// </param>
public record AppearanceSettingsDto(string Theme, string Skin, bool Wallpaper = true, string? WallpaperPhoto = null)
{
    public static readonly string[] Themes = ["System", "Light", "Dark"];
    public static readonly string[] Skins = ["Indigo", "Ocean", "Forest", "Sunset", "Rose", "Graphite"];
}
