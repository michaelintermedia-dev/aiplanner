using FluentValidation;

namespace AiPlanner.Application.Items.DTOs;

public class ConvertItemRequestValidator : AbstractValidator<ConvertItemRequest>
{
    private static readonly string[] Types = ["Task", "Appointment", "Note"];

    public ConvertItemRequestValidator()
    {
        RuleFor(x => x.FromType).Must(t => Types.Contains(t)).WithMessage("FromType must be Task, Appointment or Note.");
        RuleFor(x => x.ToType).Must(t => Types.Contains(t)).WithMessage("ToType must be Task, Appointment or Note.");
        RuleFor(x => x.ToType).NotEqual(x => x.FromType).WithMessage("The item is already that type.");
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.EndUtc).GreaterThan(x => x.StartUtc).When(x => x.StartUtc is not null && x.EndUtc is not null);
    }
}
