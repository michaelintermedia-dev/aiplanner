using AiPlanner.Domain.Enums;
using FluentValidation;

namespace AiPlanner.Application.Reminders;

public class ReminderDtoValidator : AbstractValidator<ReminderDto>
{
    /// <summary>Up to 30 days before the item.</summary>
    public const int MaxMinutesBefore = 30 * 24 * 60;

    public ReminderDtoValidator()
    {
        RuleFor(r => r.Kind).IsInEnum();
        RuleFor(r => r.AtUtc).NotNull().When(r => r.Kind == ReminderKind.At).WithMessage("Pick when to be reminded.");
        RuleFor(r => r.MinutesBefore).NotNull().InclusiveBetween(0, MaxMinutesBefore).When(r => r.Kind == ReminderKind.Before);
        RuleFor(r => r.Time)
            .Must(t => ReminderSchedule.ParseTime(t) is not null)
            .When(r => ReminderSchedule.Repeats(r.Kind))
            .WithMessage("Pick a time for the reminder (HH:mm).");
        RuleFor(r => r.Days)
            .Must(d => d is { Count: > 0 } && d.All(Enum.IsDefined))
            .When(r => r.Kind == ReminderKind.Weekly)
            .WithMessage("Pick at least one day for a weekly reminder.");
    }
}
