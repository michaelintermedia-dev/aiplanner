using AiPlanner.Domain.Enums;

namespace AiPlanner.Application.Appointments.DTOs;

public record AppointmentQueryParameters(
    DateTime? FromUtc,
    DateTime? ToUtc,
    AppointmentStatus? Status);
