using AiPlanner.Application.Appointments.Interfaces;
using AiPlanner.Application.Appointments.Services;
using AiPlanner.Application.Calendar.Interfaces;
using AiPlanner.Application.Calendar.Services;
using AiPlanner.Application.Captures.Interfaces;
using AiPlanner.Application.Captures.Services;
using AiPlanner.Application.Tasks.Interfaces;
using AiPlanner.Application.Tasks.Services;
using AiPlanner.Application.Today.Interfaces;
using AiPlanner.Application.Today.Services;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace AiPlanner.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);

        services.AddScoped<ITaskService, TaskService>();
        services.AddScoped<IAppointmentService, AppointmentService>();
        services.AddScoped<ITodayService, TodayService>();
        services.AddScoped<ICalendarService, CalendarService>();
        services.AddScoped<ICaptureService, CaptureService>();

        return services;
    }
}
