using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Enums;
using FluentValidation;

namespace AiPlanner.Application.Tasks.DTOs;

public class UpdateTaskRequestValidator : AbstractValidator<UpdateTaskRequest>
{
    public UpdateTaskRequestValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Description).MaximumLength(4000);

        RuleFor(x => x.Reminders).Must(r => r is null || r.Count <= ReminderPlanner.MaxPerItem)
            .WithMessage($"At most {ReminderPlanner.MaxPerItem} reminders.");
        RuleForEach(x => x.Reminders).SetValidator(new ReminderDtoValidator());
        RuleFor(x => x)
            .Must(x => x.DueDateUtc.HasValue && x.HasDueTime)
            .WithMessage("A reminder before the task needs a due date and time.")
            .When(x => x.Reminders?.Any(r => r.Kind == ReminderKind.Before) == true);

        RuleForEach(x => x.Tags).NotEmpty().MaximumLength(100).When(x => x.Tags is not null);
    }
}
