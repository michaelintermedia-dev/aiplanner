using FluentValidation;

namespace AiPlanner.Application.Notifications.DTOs;

public class SnoozeRequestValidator : AbstractValidator<SnoozeRequest>
{
    public SnoozeRequestValidator()
    {
        RuleFor(x => x.ItemType).Must(t => t is "Task" or "Appointment" or "Note").WithMessage("ItemType must be Task, Appointment or Note.");
        RuleFor(x => x.ItemId).NotEmpty();
        RuleFor(x => x.Title).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Body).MaximumLength(2000);
        RuleFor(x => x.Minutes).InclusiveBetween(1, 7 * 24 * 60);
    }
}
