using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Enums;
using FluentValidation;

namespace AiPlanner.Application.Notes.DTOs;

public class SaveNoteRequestValidator : AbstractValidator<SaveNoteRequest>
{
    public SaveNoteRequestValidator()
    {
        RuleFor(x => x.Title).MaximumLength(300);
        RuleFor(x => x.Content).NotEmpty().MaximumLength(20_000);
        RuleFor(x => x.Reminder!).SetValidator(new ReminderDtoValidator()).When(x => x.Reminder is not null);
        RuleFor(x => x.Reminder!.Kind).NotEqual(ReminderKind.Before).When(x => x.Reminder is not null)
            .WithMessage("A note has no time of its own - pick when to be reminded.");
    }
}
