using FluentValidation;

namespace AiPlanner.Application.Auth.DTOs;

public class ExternalLoginRequestValidator : AbstractValidator<ExternalLoginRequest>
{
    public ExternalLoginRequestValidator()
    {
        RuleFor(x => x.Provider).NotEmpty().MaximumLength(20);
        RuleFor(x => x.IdToken).NotEmpty().MaximumLength(8000);
        RuleFor(x => x.Nonce).MaximumLength(200);
        RuleFor(x => x.DisplayName).MaximumLength(100);
        RuleFor(x => x.TimeZoneId).MaximumLength(100);
        RuleFor(x => x.Locale).MaximumLength(20);
        RuleFor(x => x.DeviceInfo).MaximumLength(200);
    }
}
