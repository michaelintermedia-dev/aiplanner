using AiPlanner.Application.Appointments.Interfaces;
using AiPlanner.Application.Attachments.Interfaces;
using AiPlanner.Application.Attachments.Services;
using AiPlanner.Application.Appointments.Services;
using AiPlanner.Application.Calendar.Interfaces;
using AiPlanner.Application.Calendar.Services;
using AiPlanner.Application.Captures.Interfaces;
using AiPlanner.Application.Captures.Services;
using AiPlanner.Application.Feed.Interfaces;
using AiPlanner.Application.Feed.Services;
using AiPlanner.Application.Notes.Interfaces;
using AiPlanner.Application.Notes.Services;
using AiPlanner.Application.Tasks.Interfaces;
using AiPlanner.Application.Tasks.Services;
using AiPlanner.Application.Today.Interfaces;
using AiPlanner.Application.Today.Services;
using AiPlanner.Application.Items.Interfaces;
using AiPlanner.Application.Items.Services;
using AiPlanner.Application.Notifications.Interfaces;
using AiPlanner.Application.Notifications.Services;
using AiPlanner.Application.Reminders;
using AiPlanner.Application.Settings.Services;
using AiPlanner.Application.Users.Interfaces;
using AiPlanner.Application.Users.Services;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace AiPlanner.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);

        services.AddScoped<ReminderPlanner>();
        services.AddScoped<ITaskService, TaskService>();
        services.AddScoped<IAppointmentService, AppointmentService>();
        services.AddScoped<ITodayService, TodayService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IItemConversionService, ItemConversionService>();
        services.AddScoped<IItemDeletionService, ItemDeletionService>();
        services.AddScoped<RecordingCleanup>();
        services.AddScoped<RecordingSettingsService>();
        services.AddScoped<AppearanceSettingsService>();
        services.AddScoped<CalendarSettingsService>();
        services.AddScoped<IUserProfileService, UserProfileService>();
        services.AddScoped<ICalendarService, CalendarService>();
        services.AddScoped<ICaptureService, CaptureService>();
        services.AddScoped<INoteService, NoteService>();
        services.AddScoped<IFeedService, FeedService>();
        services.AddScoped<IAttachmentService, AttachmentService>();

        return services;
    }
}
