using AiPlanner.Application.Reminders;
using FluentValidation;

namespace AiPlanner.Application.Appointments.DTOs;

public class CreateAppointmentRequestValidator : AbstractValidator<CreateAppointmentRequest>
{
    public CreateAppointmentRequestValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Location).MaximumLength(300);
        RuleFor(x => x.EndUtc).GreaterThan(x => x.StartUtc).WithMessage("EndUtc must be after StartUtc.");
        RuleFor(x => x.Reminder!).SetValidator(new ReminderDtoValidator()).When(x => x.Reminder is not null);
        RuleForEach(x => x.ParticipantNames).NotEmpty().MaximumLength(200).When(x => x.ParticipantNames is not null);
    }
}
