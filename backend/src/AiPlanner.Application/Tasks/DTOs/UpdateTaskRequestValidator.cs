using FluentValidation;

namespace AiPlanner.Application.Tasks.DTOs;

public class UpdateTaskRequestValidator : AbstractValidator<UpdateTaskRequest>
{
    public UpdateTaskRequestValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Description).MaximumLength(4000);

        RuleFor(x => x.ReminderMinutesBeforeDue)
            .GreaterThanOrEqualTo(0)
            .When(x => x.ReminderMinutesBeforeDue.HasValue);

        RuleFor(x => x)
            .Must(x => x.DueDateUtc.HasValue)
            .WithMessage("DueDateUtc is required when ReminderMinutesBeforeDue is set.")
            .When(x => x.ReminderMinutesBeforeDue.HasValue);

        RuleForEach(x => x.Tags).NotEmpty().MaximumLength(100).When(x => x.Tags is not null);
    }
}
