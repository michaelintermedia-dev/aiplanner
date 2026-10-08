namespace AiPlanner.Application.Settings.DTOs;

/// <summary>Settings - Appearance: light/dark and the colour scheme. Kept on the account, so every device follows.</summary>
/// <param name="Theme">"System" (follow the device), "Light" or "Dark".</param>
/// <param name="Skin">One of <see cref="Skins"/> - its colours and its wallpaper.</param>
/// <param name="Wallpaper">Show the skin's wallpaper behind the content.</param>
public record AppearanceSettingsDto(string Theme, string Skin, bool Wallpaper = true)
{
    public static readonly string[] Themes = ["System", "Light", "Dark"];
    public static readonly string[] Skins = ["Indigo", "Ocean", "Forest", "Sunset", "Rose", "Graphite"];
}
