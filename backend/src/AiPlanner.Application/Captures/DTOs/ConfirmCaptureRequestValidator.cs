using AiPlanner.Application.Ai.Services;
using AiPlanner.Domain.Enums;
using AiPlanner.Application.Reminders;
using FluentValidation;

namespace AiPlanner.Application.Captures.DTOs;

public class ConfirmCaptureRequestValidator : AbstractValidator<ConfirmCaptureRequest>
{
    public ConfirmCaptureRequestValidator()
    {
        RuleFor(x => x.Items).NotEmpty();
        RuleFor(x => x.Items).Must(items => items.Select(i => i.Id).Distinct().Count() == items.Count)
            .WithMessage("Each item may only be listed once.");

        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.Id).NotEmpty();
            item.RuleFor(i => i.Intent).IsInEnum();

            item.RuleFor(i => i.AppendToType).Must(t => t is "Task" or "Appointment" or "Note")
                .When(i => i.Include && i.AppendToId is not null)
                .WithMessage("AppendToType must be Task, Appointment or Note.");

            // A text-only addition to an existing item only contributes text.
            item.RuleFor(i => i.Description).MaximumLength(4000)
                .When(i => i.Include && i.AppendToId is not null && !i.ReplacesItem && !i.LinkOnly);

            // New items, and whole-item updates (ReplacesItem: the fields ARE the item after the change).
            // Linking needs the item it belongs to (the fields were saved by its own form).
            item.RuleFor(i => i.AppendToId).NotNull().When(i => i.Include && i.LinkOnly)
                .WithMessage("LinkOnly needs AppendToType and AppendToId.");

            item.When(i => i.Include && !i.LinkOnly && (i.AppendToId is null || i.ReplacesItem), () =>
            {
                item.RuleFor(i => i.Title).NotEmpty().MaximumLength(ExtractionNormalizer.MaxTitleLength);
                item.RuleFor(i => i.Description).MaximumLength(4000);
                item.RuleFor(i => i.Location).MaximumLength(300);
                item.RuleFor(i => i.Reminders).Must(r => r is null || r.Count <= ReminderPlanner.MaxPerItem)
                    .WithMessage($"At most {ReminderPlanner.MaxPerItem} reminders.");
                item.RuleForEach(i => i.Reminders).SetValidator(new ReminderDtoValidator());

                item.When(i => i.Intent == ExtractionIntent.Appointment, () =>
                {
                    item.RuleFor(i => i.StartUtc).NotNull().WithMessage("An appointment needs a start time.");
                    item.RuleFor(i => i.EndUtc).NotNull().WithMessage("An appointment needs an end time.");
                    item.RuleFor(i => i.EndUtc).GreaterThan(i => i.StartUtc)
                        .When(i => i.StartUtc is not null && i.EndUtc is not null)
                        .WithMessage("An appointment must end after it starts.");
                });

                item.RuleForEach(i => i.Reminders).Must(r => r.Kind != ReminderKind.Before)
                    .When(i => i.Intent == ExtractionIntent.Note)
                    .WithMessage("A note has no time of its own - pick when to be reminded.");

                // Legacy intent: clients no longer offer it; it is saved as a task.
                item.When(i => i.Intent == ExtractionIntent.Reminder, () =>
                {
                    item.RuleFor(i => i.DueUtc).NotNull().WithMessage("A reminder needs a date and time.");
                    item.RuleFor(i => i.HasTime).Equal(true).WithMessage("A reminder needs a time.");
                });
            });
        });
    }
}
