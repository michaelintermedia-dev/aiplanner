using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Enums;
using FluentValidation;

namespace AiPlanner.Application.Tasks.DTOs;

public class CreateTaskRequestValidator : AbstractValidator<CreateTaskRequest>
{
    public CreateTaskRequestValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Description).MaximumLength(4000);

        RuleFor(x => x.Reminder!).SetValidator(new ReminderDtoValidator()).When(x => x.Reminder is not null);
        RuleFor(x => x)
            .Must(x => x.DueDateUtc.HasValue && x.HasDueTime)
            .WithMessage("A reminder before the task needs a due date and time.")
            .When(x => x.Reminder?.Kind == ReminderKind.Before);

        RuleForEach(x => x.Tags).NotEmpty().MaximumLength(100).When(x => x.Tags is not null);
    }
}
