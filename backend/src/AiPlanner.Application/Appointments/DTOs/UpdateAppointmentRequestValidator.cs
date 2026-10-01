using AiPlanner.Application.Reminders;
using FluentValidation;

namespace AiPlanner.Application.Appointments.DTOs;

public class UpdateAppointmentRequestValidator : AbstractValidator<UpdateAppointmentRequest>
{
    public UpdateAppointmentRequestValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Location).MaximumLength(300);
        RuleFor(x => x.EndUtc).GreaterThan(x => x.StartUtc).WithMessage("EndUtc must be after StartUtc.");
        RuleFor(x => x.Reminders).Must(r => r is null || r.Count <= ReminderPlanner.MaxPerItem)
            .WithMessage($"At most {ReminderPlanner.MaxPerItem} reminders.");
        RuleForEach(x => x.Reminders).SetValidator(new ReminderDtoValidator());
        RuleForEach(x => x.ParticipantNames).NotEmpty().MaximumLength(200).When(x => x.ParticipantNames is not null);
    }
}
