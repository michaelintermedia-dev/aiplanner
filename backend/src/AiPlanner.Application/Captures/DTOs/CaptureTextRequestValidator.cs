using FluentValidation;

namespace AiPlanner.Application.Captures.DTOs;

public class CaptureTextRequestValidator : AbstractValidator<CaptureTextRequest>
{
    public CaptureTextRequestValidator()
    {
        RuleFor(x => x.Text).NotEmpty().MaximumLength(10_000);
    }
}
