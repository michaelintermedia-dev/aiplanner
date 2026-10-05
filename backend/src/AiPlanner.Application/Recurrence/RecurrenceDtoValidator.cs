using AiPlanner.Domain.Enums;
using FluentValidation;

namespace AiPlanner.Application.Recurrence;

public class RecurrenceDtoValidator : AbstractValidator<RecurrenceDto>
{
    public RecurrenceDtoValidator()
    {
        RuleFor(r => r.Frequency)
            .Must(f => f is RecurrenceFrequency.Daily or RecurrenceFrequency.Weekdays or RecurrenceFrequency.Weekly or RecurrenceFrequency.Monthly)
            .WithMessage("Repeat must be daily, weekdays, weekly or monthly.");
        RuleFor(r => r.Interval).InclusiveBetween(1, 99);
        RuleFor(r => r.MonthDay).InclusiveBetween(1, 31).When(r => r.MonthDay is not null);
        RuleFor(r => r.Count).InclusiveBetween(1, 999).When(r => r.Count is not null);
        RuleFor(r => r.Days).Must(d => d is null || d.Count <= 7).WithMessage("At most 7 days.");
        RuleFor(r => r).Must(r => r.Until is null || r.Count is null).WithMessage("Repeat until a date or a number of times, not both.");
    }
}
