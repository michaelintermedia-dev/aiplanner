using AiPlanner.Application.Common.Utils;
using FluentValidation;

namespace AiPlanner.Application.Users.DTOs;

public class UpdateProfileRequestValidator : AbstractValidator<UpdateProfileRequest>
{
    public UpdateProfileRequestValidator()
    {
        RuleFor(x => x.Locale).Must(LocaleHelper.IsValid).When(x => x.Locale is not null).WithMessage("Unknown locale.");
    }
}
