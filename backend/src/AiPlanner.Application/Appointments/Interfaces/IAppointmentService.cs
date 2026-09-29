using AiPlanner.Application.Appointments.DTOs;
using AiPlanner.Application.Common.Models;

namespace AiPlanner.Application.Appointments.Interfaces;

public interface IAppointmentService
{
    Task<IReadOnlyList<AppointmentDto>> GetListAsync(AppointmentQueryParameters query, CancellationToken ct = default);

    Task<Result<AppointmentDto>> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<Result<AppointmentDto>> CreateAsync(CreateAppointmentRequest request, CancellationToken ct = default);

    Task<Result<AppointmentDto>> UpdateAsync(Guid id, UpdateAppointmentRequest request, CancellationToken ct = default);

    Task<Result<AppointmentDto>> RescheduleAsync(Guid id, RescheduleAppointmentRequest request, CancellationToken ct = default);

    Task<Result<AppointmentDto>> CompleteAsync(Guid id, CancellationToken ct = default);

    Task<Result<AppointmentDto>> CancelAsync(Guid id, CancellationToken ct = default);

    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
}
