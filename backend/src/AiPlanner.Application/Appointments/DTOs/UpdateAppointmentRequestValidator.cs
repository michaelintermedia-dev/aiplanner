using FluentValidation;

namespace AiPlanner.Application.Appointments.DTOs;

public class UpdateAppointmentRequestValidator : AbstractValidator<UpdateAppointmentRequest>
{
    public UpdateAppointmentRequestValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Location).MaximumLength(300);
        RuleFor(x => x.EndUtc).GreaterThan(x => x.StartUtc).WithMessage("EndUtc must be after StartUtc.");
        RuleFor(x => x.ReminderMinutesBeforeStart).GreaterThanOrEqualTo(0).When(x => x.ReminderMinutesBeforeStart.HasValue);
        RuleForEach(x => x.ParticipantNames).NotEmpty().MaximumLength(200).When(x => x.ParticipantNames is not null);
    }
}
