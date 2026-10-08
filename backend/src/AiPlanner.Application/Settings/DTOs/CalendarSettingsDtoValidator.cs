using FluentValidation;

namespace AiPlanner.Application.Settings.DTOs;

public class CalendarSettingsDtoValidator : AbstractValidator<CalendarSettingsDto>
{
    public CalendarSettingsDtoValidator()
    {
        RuleFor(x => x.FirstDayOfWeek).Must(d => CalendarSettingsDto.FirstDays.Contains(d))
            .WithMessage($"FirstDayOfWeek must be one of: {string.Join(", ", CalendarSettingsDto.FirstDays)}.");
    }
}
