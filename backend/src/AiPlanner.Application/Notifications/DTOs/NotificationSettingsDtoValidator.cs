using AiPlanner.Application.Reminders;
using FluentValidation;

namespace AiPlanner.Application.Notifications.DTOs;

public class NotificationSettingsDtoValidator : AbstractValidator<NotificationSettingsDto>
{
    public NotificationSettingsDtoValidator()
    {
        RuleFor(x => x.EventReminderMinutes).InclusiveBetween(0, 1440).When(x => x.EventReminderMinutes is not null);
        RuleFor(x => x.DailySummaryTime).Must(t => ReminderSchedule.ParseTime(t) is not null).WithMessage("DailySummaryTime must be HH:mm.");
    }
}
