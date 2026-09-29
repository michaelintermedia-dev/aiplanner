using FluentValidation;

namespace AiPlanner.Application.Appointments.DTOs;

public class RescheduleAppointmentRequestValidator : AbstractValidator<RescheduleAppointmentRequest>
{
    public RescheduleAppointmentRequestValidator()
    {
        RuleFor(x => x.NewEndUtc).GreaterThan(x => x.NewStartUtc);
    }
}
