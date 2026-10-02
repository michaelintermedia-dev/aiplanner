using System.Globalization;

namespace AiPlanner.Application.Notifications.Services;

/// <summary>
/// What notifications say, in the user's language (User.Locale). The clients
/// translate their own UI; these texts are built here because the server
/// owns the notifications. Unknown languages fall back to English.
/// </summary>
public sealed class NotificationTexts
{
    public required CultureInfo Culture { get; init; }
    public required Func<int, string> Minutes { get; init; }
    public required Func<int, string> Hours { get; init; }
    public required Func<int, string> Days { get; init; }
    public required Func<int, int, string> HoursMinutes { get; init; }
    public required string StartingNow { get; init; }
    public required Func<string, string> StartsIn { get; init; }
    public required string DueNow { get; init; }
    public required Func<string, string> DueIn { get; init; }
    public required Func<string, string> StartsAt { get; init; }
    public required Func<string, string> DueAt { get; init; }
    public required string TaskReminder { get; init; }
    public required string EventReminder { get; init; }
    public required string NoteReminder { get; init; }
    public required string YourDay { get; init; }
    public required Func<int, string> TasksDueToday { get; init; }
    public required Func<int, string> Important { get; init; }
    public required Func<int, string> Overdue { get; init; }
    public required Func<int, string> Events { get; init; }

    public static NotificationTexts For(string? locale) =>
        (locale ?? "").Split('-', '_')[0].ToLowerInvariant() switch
        {
            "ru" => Russian,
            "he" or "iw" => Hebrew,
            _ => English,
        };

    public static readonly NotificationTexts English = new()
    {
        Culture = CultureInfo.GetCultureInfo("en-GB"),
        Minutes = n => n == 1 ? "1 minute" : $"{n} minutes",
        Hours = n => n == 1 ? "1 hour" : $"{n} hours",
        Days = n => n == 1 ? "1 day" : $"{n} days",
        HoursMinutes = (h, m) => $"{h} h {m} min",
        StartingNow = "Starting now",
        StartsIn = x => $"Starts in {x}",
        DueNow = "Due now",
        DueIn = x => $"Due in {x}",
        StartsAt = x => $"Starts at {x}",
        DueAt = x => $"Due {x}",
        TaskReminder = "Task reminder",
        EventReminder = "Event reminder",
        NoteReminder = "Note reminder",
        YourDay = "Your day",
        TasksDueToday = n => n == 1 ? "1 task due today" : $"{n} tasks due today",
        Important = n => $" ({n} important)",
        Overdue = n => $"{n} overdue",
        Events = n => n == 1 ? "1 event" : $"{n} events",
    };

    // Russian nouns take one of three forms: 1 минута, 2 минуты, 5 минут.
    private static string Ru(int n, string one, string few, string many)
    {
        var tens = n % 100;
        var units = n % 10;
        var word = tens is >= 11 and <= 14 ? many : units == 1 ? one : units is >= 2 and <= 4 ? few : many;
        return $"{n} {word}";
    }

    public static readonly NotificationTexts Russian = new()
    {
        Culture = CultureInfo.GetCultureInfo("ru-RU"),
        // After "через": через 1 минуту / 2 минуты / 5 минут.
        Minutes = n => Ru(n, "минуту", "минуты", "минут"),
        Hours = n => Ru(n, "час", "часа", "часов"),
        Days = n => Ru(n, "день", "дня", "дней"),
        HoursMinutes = (h, m) => $"{h} ч {m} мин",
        StartingNow = "Начинается сейчас",
        StartsIn = x => $"Начало через {x}",
        DueNow = "Срок — сейчас",
        DueIn = x => $"Срок через {x}",
        StartsAt = x => $"Начало в {x}",
        DueAt = x => $"Срок: {x}",
        TaskReminder = "Напоминание о задаче",
        EventReminder = "Напоминание о событии",
        NoteReminder = "Напоминание о заметке",
        YourDay = "Ваш день",
        TasksDueToday = n => Ru(n, "задача", "задачи", "задач") + " на сегодня",
        Important = n => $" (важных: {n})",
        Overdue = n => $"просрочено: {n}",
        Events = n => Ru(n, "событие", "события", "событий"),
    };

    public static readonly NotificationTexts Hebrew = new()
    {
        Culture = CultureInfo.GetCultureInfo("he-IL"),
        Minutes = n => n == 1 ? "דקה" : $"{n} דקות",
        Hours = n => n switch { 1 => "שעה", 2 => "שעתיים", _ => $"{n} שעות" },
        Days = n => n switch { 1 => "יום", 2 => "יומיים", _ => $"{n} ימים" },
        HoursMinutes = (h, m) => $"{h} שע' {m} דק'",
        StartingNow = "מתחיל עכשיו",
        StartsIn = x => $"מתחיל בעוד {x}",
        DueNow = "מועד היעד עכשיו",
        DueIn = x => $"מועד היעד בעוד {x}",
        StartsAt = x => $"מתחיל ב-{x}",
        DueAt = x => $"מועד יעד: {x}",
        TaskReminder = "תזכורת למשימה",
        EventReminder = "תזכורת לאירוע",
        NoteReminder = "תזכורת לפתק",
        YourDay = "היום שלך",
        TasksDueToday = n => n == 1 ? "משימה אחת להיום" : $"{n} משימות להיום",
        Important = n => n == 1 ? " (אחת חשובה)" : $" ({n} חשובות)",
        Overdue = n => $"{n} באיחור",
        Events = n => n == 1 ? "אירוע אחד" : $"{n} אירועים",
    };
}
