namespace AiPlanner.Application.Appointments.DTOs;

/// <summary>Dedicated "move this appointment" action (spec section 11 - "must be easy to reschedule").</summary>
public record RescheduleAppointmentRequest(DateTime NewStartUtc, DateTime NewEndUtc);
