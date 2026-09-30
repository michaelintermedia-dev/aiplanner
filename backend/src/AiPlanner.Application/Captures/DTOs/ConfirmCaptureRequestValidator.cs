using AiPlanner.Application.Ai.Services;
using AiPlanner.Domain.Enums;
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

            item.When(i => i.Include, () =>
            {
                item.RuleFor(i => i.Title).NotEmpty().MaximumLength(ExtractionNormalizer.MaxTitleLength);
                item.RuleFor(i => i.Description).MaximumLength(4000);
                item.RuleFor(i => i.Location).MaximumLength(300);
                item.RuleFor(i => i.ReminderMinutesBefore).InclusiveBetween(0, ExtractionNormalizer.MaxReminderMinutes);

                item.When(i => i.Intent == ExtractionIntent.Appointment, () =>
                {
                    item.RuleFor(i => i.StartUtc).NotNull().WithMessage("An appointment needs a start time.");
                    item.RuleFor(i => i.EndUtc).NotNull().WithMessage("An appointment needs an end time.");
                    item.RuleFor(i => i.EndUtc).GreaterThan(i => i.StartUtc)
                        .When(i => i.StartUtc is not null && i.EndUtc is not null)
                        .WithMessage("An appointment must end after it starts.");
                });

                item.When(i => i.Intent == ExtractionIntent.Reminder, () =>
                {
                    item.RuleFor(i => i.DueUtc).NotNull().WithMessage("A reminder needs a date and time.");
                    item.RuleFor(i => i.HasTime).Equal(true).WithMessage("A reminder needs a time.");
                });
            });
        });
    }
}
