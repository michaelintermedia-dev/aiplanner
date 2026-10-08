using FluentValidation;

namespace AiPlanner.Application.Settings.DTOs;

public class AppearanceSettingsDtoValidator : AbstractValidator<AppearanceSettingsDto>
{
    public AppearanceSettingsDtoValidator()
    {
        RuleFor(x => x.Theme).Must(t => AppearanceSettingsDto.Themes.Contains(t))
            .WithMessage($"Theme must be one of: {string.Join(", ", AppearanceSettingsDto.Themes)}.");
        RuleFor(x => x.Skin).Must(s => AppearanceSettingsDto.Skins.Contains(s))
            .WithMessage($"Skin must be one of: {string.Join(", ", AppearanceSettingsDto.Skins)}.");
    }
}
