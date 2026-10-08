using AiPlanner.Application.Reminders;
using AiPlanner.Domain.Enums;
using FluentValidation;

namespace AiPlanner.Application.Notes.DTOs;

public class SaveNoteRequestValidator : AbstractValidator<SaveNoteRequest>
{
    public SaveNoteRequestValidator()
    {
        RuleForEach(x => x.Tags).NotEmpty().MaximumLength(100).When(x => x.Tags is not null);
        RuleFor(x => x.Title).MaximumLength(300);
        RuleFor(x => x.Content).NotEmpty().MaximumLength(20_000);
        RuleFor(x => x.Reminders).Must(r => r is null || r.Count <= ReminderPlanner.MaxPerItem)
            .WithMessage($"At most {ReminderPlanner.MaxPerItem} reminders.");
        RuleForEach(x => x.Reminders).SetValidator(new ReminderDtoValidator());
        RuleForEach(x => x.Reminders).Must(r => r.Kind != ReminderKind.Before)
            .WithMessage("A note has no time of its own - pick when to be reminded.");
    }
}
