using System.Globalization;

namespace AiPlanner.Application.Notifications.Services;

/// <summary>
/// What notifications say, in the user's language (User.Locale). The clients
/// translate their own UI; these texts are built here because the server
/// owns the notifications. Unknown languages fall back to English.
/// The languages are the apps' (shared/i18n LANGUAGES) - add one in both places.
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
            "es" => Spanish,
            "fr" => French,
            "de" => German,
            "pt" => Portuguese,
            "it" => Italian,
            "pl" => Polish,
            "ro" => Romanian,
            "uk" => Ukrainian,
            "tr" => Turkish,
            "ar" => Arabic,
            "hi" => Hindi,
            "zh" => Chinese,
            "ja" => Japanese,
            "ko" => Korean,
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

    // Russian and Ukrainian nouns take one of three forms: 1 минута, 2 минуты, 5 минут.
    private static string Slavic(int n, string one, string few, string many)
    {
        var tens = n % 100;
        var units = n % 10;
        var word = tens is >= 11 and <= 14 ? many : units == 1 ? one : units is >= 2 and <= 4 ? few : many;
        return $"{n} {word}";
    }

    // Polish: 1 minuta, 2–4 minuty (not 12–14), else minut.
    private static string Pl(int n, string one, string few, string many)
    {
        var tens = n % 100;
        var units = n % 10;
        var word = n == 1 ? one : units is >= 2 and <= 4 && tens is < 12 or > 14 ? few : many;
        return $"{n} {word}";
    }

    // Arabic: 1 and 2 have their own words, 3–10 the plural, 11–99 the singular accusative, 100+ the singular.
    private static string Ar(int n, string one, string two, string few, string many, string other) =>
        n switch
        {
            1 => one,
            2 => two,
            _ when n % 100 is >= 3 and <= 10 => $"{n} {few}",
            _ when n % 100 >= 11 => $"{n} {many}",
            _ => $"{n} {other}",
        };

    public static readonly NotificationTexts Russian = new()
    {
        Culture = CultureInfo.GetCultureInfo("ru-RU"),
        // After "через": через 1 минуту / 2 минуты / 5 минут.
        Minutes = n => Slavic(n, "минуту", "минуты", "минут"),
        Hours = n => Slavic(n, "час", "часа", "часов"),
        Days = n => Slavic(n, "день", "дня", "дней"),
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
        TasksDueToday = n => Slavic(n, "задача", "задачи", "задач") + " на сегодня",
        Important = n => $" (важных: {n})",
        Overdue = n => $"просрочено: {n}",
        Events = n => Slavic(n, "событие", "события", "событий"),
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

    public static readonly NotificationTexts Spanish = new()
    {
        Culture = CultureInfo.GetCultureInfo("es-ES"),
        Minutes = n => n == 1 ? "1 minuto" : $"{n} minutos",
        Hours = n => n == 1 ? "1 hora" : $"{n} horas",
        Days = n => n == 1 ? "1 día" : $"{n} días",
        HoursMinutes = (h, m) => $"{h} h {m} min",
        StartingNow = "Empieza ahora",
        StartsIn = x => $"Empieza en {x}",
        DueNow = "Vence ahora",
        DueIn = x => $"Vence en {x}",
        StartsAt = x => $"Empieza: {x}",
        DueAt = x => $"Vence: {x}",
        TaskReminder = "Recordatorio de tarea",
        EventReminder = "Recordatorio de evento",
        NoteReminder = "Recordatorio de nota",
        YourDay = "Tu día",
        TasksDueToday = n => n == 1 ? "1 tarea vence hoy" : $"{n} tareas vencen hoy",
        Important = n => n == 1 ? " (1 importante)" : $" ({n} importantes)",
        Overdue = n => n == 1 ? "1 atrasada" : $"{n} atrasadas",
        Events = n => n == 1 ? "1 evento" : $"{n} eventos",
    };

    public static readonly NotificationTexts French = new()
    {
        Culture = CultureInfo.GetCultureInfo("fr-FR"),
        Minutes = n => n <= 1 ? $"{n} minute" : $"{n} minutes",
        Hours = n => n <= 1 ? $"{n} heure" : $"{n} heures",
        Days = n => n <= 1 ? $"{n} jour" : $"{n} jours",
        HoursMinutes = (h, m) => $"{h} h {m} min",
        StartingNow = "Commence maintenant",
        StartsIn = x => $"Commence dans {x}",
        DueNow = "À faire maintenant",
        DueIn = x => $"Échéance dans {x}",
        StartsAt = x => $"Commence : {x}",
        DueAt = x => $"Échéance : {x}",
        TaskReminder = "Rappel de tâche",
        EventReminder = "Rappel d’événement",
        NoteReminder = "Rappel de note",
        YourDay = "Votre journée",
        TasksDueToday = n => n <= 1 ? $"{n} tâche pour aujourd’hui" : $"{n} tâches pour aujourd’hui",
        Important = n => n <= 1 ? $" ({n} importante)" : $" ({n} importantes)",
        Overdue = n => n <= 1 ? $"{n} en retard" : $"{n} en retard",
        Events = n => n <= 1 ? $"{n} événement" : $"{n} événements",
    };

    public static readonly NotificationTexts German = new()
    {
        Culture = CultureInfo.GetCultureInfo("de-DE"),
        // After "in": in 1 Minute / 5 Minuten, in 1 Tag / 3 Tagen (dative).
        Minutes = n => n == 1 ? "1 Minute" : $"{n} Minuten",
        Hours = n => n == 1 ? "1 Stunde" : $"{n} Stunden",
        Days = n => n == 1 ? "1 Tag" : $"{n} Tagen",
        HoursMinutes = (h, m) => $"{h} Std. {m} Min.",
        StartingNow = "Beginnt jetzt",
        StartsIn = x => $"Beginnt in {x}",
        DueNow = "Jetzt fällig",
        DueIn = x => $"Fällig in {x}",
        StartsAt = x => $"Beginnt: {x}",
        DueAt = x => $"Fällig: {x}",
        TaskReminder = "Erinnerung an Aufgabe",
        EventReminder = "Erinnerung an Termin",
        NoteReminder = "Erinnerung an Notiz",
        YourDay = "Dein Tag",
        TasksDueToday = n => n == 1 ? "1 Aufgabe heute fällig" : $"{n} Aufgaben heute fällig",
        Important = n => n == 1 ? " (1 wichtig)" : $" ({n} wichtig)",
        Overdue = n => $"{n} überfällig",
        Events = n => n == 1 ? "1 Termin" : $"{n} Termine",
    };

    public static readonly NotificationTexts Portuguese = new()
    {
        Culture = CultureInfo.GetCultureInfo("pt-BR"),
        Minutes = n => n <= 1 ? $"{n} minuto" : $"{n} minutos",
        Hours = n => n <= 1 ? $"{n} hora" : $"{n} horas",
        Days = n => n <= 1 ? $"{n} dia" : $"{n} dias",
        HoursMinutes = (h, m) => $"{h} h {m} min",
        StartingNow = "Começa agora",
        StartsIn = x => $"Começa em {x}",
        DueNow = "Vence agora",
        DueIn = x => $"Vence em {x}",
        StartsAt = x => $"Começa: {x}",
        DueAt = x => $"Prazo: {x}",
        TaskReminder = "Lembrete de tarefa",
        EventReminder = "Lembrete de evento",
        NoteReminder = "Lembrete de nota",
        YourDay = "Seu dia",
        TasksDueToday = n => n <= 1 ? $"{n} tarefa vence hoje" : $"{n} tarefas vencem hoje",
        Important = n => n <= 1 ? $" ({n} importante)" : $" ({n} importantes)",
        Overdue = n => n <= 1 ? $"{n} atrasada" : $"{n} atrasadas",
        Events = n => n <= 1 ? $"{n} evento" : $"{n} eventos",
    };

    public static readonly NotificationTexts Italian = new()
    {
        Culture = CultureInfo.GetCultureInfo("it-IT"),
        Minutes = n => n == 1 ? "1 minuto" : $"{n} minuti",
        Hours = n => n == 1 ? "1 ora" : $"{n} ore",
        Days = n => n == 1 ? "1 giorno" : $"{n} giorni",
        HoursMinutes = (h, m) => $"{h} h {m} min",
        StartingNow = "Inizia ora",
        StartsIn = x => $"Inizia tra {x}",
        DueNow = "Scade ora",
        DueIn = x => $"Scade tra {x}",
        StartsAt = x => $"Inizia: {x}",
        DueAt = x => $"Scadenza: {x}",
        TaskReminder = "Promemoria attività",
        EventReminder = "Promemoria evento",
        NoteReminder = "Promemoria nota",
        YourDay = "La tua giornata",
        TasksDueToday = n => n == 1 ? "1 attività in scadenza oggi" : $"{n} attività in scadenza oggi",
        Important = n => n == 1 ? " (1 importante)" : $" ({n} importanti)",
        Overdue = n => n == 1 ? "1 in ritardo" : $"{n} in ritardo",
        Events = n => n == 1 ? "1 evento" : $"{n} eventi",
    };

    public static readonly NotificationTexts Polish = new()
    {
        Culture = CultureInfo.GetCultureInfo("pl-PL"),
        // After "za": za 1 minutę / 2 minuty / 5 minut.
        Minutes = n => Pl(n, "minutę", "minuty", "minut"),
        Hours = n => Pl(n, "godzinę", "godziny", "godzin"),
        Days = n => Pl(n, "dzień", "dni", "dni"),
        HoursMinutes = (h, m) => $"{h} godz. {m} min",
        StartingNow = "Zaczyna się teraz",
        StartsIn = x => $"Zaczyna się za {x}",
        DueNow = "Termin teraz",
        DueIn = x => $"Termin za {x}",
        StartsAt = x => $"Początek: {x}",
        DueAt = x => $"Termin: {x}",
        TaskReminder = "Przypomnienie o zadaniu",
        EventReminder = "Przypomnienie o wydarzeniu",
        NoteReminder = "Przypomnienie o notatce",
        YourDay = "Twój dzień",
        TasksDueToday = n => Pl(n, "zadanie", "zadania", "zadań") + " na dziś",
        Important = n => $" (ważne: {n})",
        Overdue = n => $"zaległe: {n}",
        Events = n => Pl(n, "wydarzenie", "wydarzenia", "wydarzeń"),
    };

    // Romanian: 1 minut, 2–19 minute, 20+ de minute (101–119 like 1–19).
    private static string Ro(int n, string one, string few)
    {
        if (n == 1) return $"1 {one}";
        return n == 0 || n % 100 is >= 1 and <= 19 ? $"{n} {few}" : $"{n} de {few}";
    }

    public static readonly NotificationTexts Romanian = new()
    {
        Culture = CultureInfo.GetCultureInfo("ro-RO"),
        Minutes = n => Ro(n, "minut", "minute"),
        Hours = n => Ro(n, "oră", "ore"),
        Days = n => Ro(n, "zi", "zile"),
        HoursMinutes = (h, m) => $"{h} h {m} min",
        StartingNow = "Începe acum",
        StartsIn = x => $"Începe în {x}",
        DueNow = "Termenul e acum",
        DueIn = x => $"Termen în {x}",
        StartsAt = x => $"Începe: {x}",
        DueAt = x => $"Termen: {x}",
        TaskReminder = "Memento pentru sarcină",
        EventReminder = "Memento pentru eveniment",
        NoteReminder = "Memento pentru notiță",
        YourDay = "Ziua ta",
        TasksDueToday = n => Ro(n, "sarcină", "sarcini") + " de făcut azi",
        Important = n => $" (importante: {n})",
        Overdue = n => $"întârziate: {n}",
        Events = n => Ro(n, "eveniment", "evenimente"),
    };

    public static readonly NotificationTexts Ukrainian = new()
    {
        Culture = CultureInfo.GetCultureInfo("uk-UA"),
        // After "через": через 1 хвилину / 2 хвилини / 5 хвилин.
        Minutes = n => Slavic(n, "хвилину", "хвилини", "хвилин"),
        Hours = n => Slavic(n, "годину", "години", "годин"),
        Days = n => Slavic(n, "день", "дні", "днів"),
        HoursMinutes = (h, m) => $"{h} год {m} хв",
        StartingNow = "Починається зараз",
        StartsIn = x => $"Початок через {x}",
        DueNow = "Термін — зараз",
        DueIn = x => $"Термін через {x}",
        StartsAt = x => $"Початок: {x}",
        DueAt = x => $"Термін: {x}",
        TaskReminder = "Нагадування про завдання",
        EventReminder = "Нагадування про подію",
        NoteReminder = "Нагадування про нотатку",
        YourDay = "Ваш день",
        TasksDueToday = n => Slavic(n, "завдання", "завдання", "завдань") + " на сьогодні",
        Important = n => $" (важливих: {n})",
        Overdue = n => $"прострочено: {n}",
        Events = n => Slavic(n, "подія", "події", "подій"),
    };

    public static readonly NotificationTexts Turkish = new()
    {
        Culture = CultureInfo.GetCultureInfo("tr-TR"),
        Minutes = n => $"{n} dakika",
        Hours = n => $"{n} saat",
        Days = n => $"{n} gün",
        HoursMinutes = (h, m) => $"{h} sa {m} dk",
        StartingNow = "Şimdi başlıyor",
        StartsIn = x => $"{x} sonra başlıyor",
        DueNow = "Son tarih şimdi",
        DueIn = x => $"{x} sonra son tarih",
        StartsAt = x => $"Başlangıç: {x}",
        DueAt = x => $"Son tarih: {x}",
        TaskReminder = "Görev hatırlatıcısı",
        EventReminder = "Etkinlik hatırlatıcısı",
        NoteReminder = "Not hatırlatıcısı",
        YourDay = "Gününüz",
        TasksDueToday = n => $"bugün son günü olan {n} görev",
        Important = n => $" ({n} önemli)",
        Overdue = n => $"{n} gecikmiş",
        Events = n => $"{n} etkinlik",
    };

    public static readonly NotificationTexts Arabic = new()
    {
        // Egyptian Arabic formats with the Gregorian calendar (ar-SA would use the Hijri one).
        Culture = CultureInfo.GetCultureInfo("ar-EG"),
        Minutes = n => Ar(n, "دقيقة", "دقيقتين", "دقائق", "دقيقة", "دقيقة"),
        Hours = n => Ar(n, "ساعة", "ساعتين", "ساعات", "ساعة", "ساعة"),
        Days = n => Ar(n, "يوم", "يومين", "أيام", "يومًا", "يوم"),
        HoursMinutes = (h, m) => $"{h} س {m} د",
        StartingNow = "يبدأ الآن",
        StartsIn = x => $"يبدأ بعد {x}",
        DueNow = "موعد الاستحقاق الآن",
        DueIn = x => $"يستحق بعد {x}",
        StartsAt = x => $"يبدأ: {x}",
        DueAt = x => $"الاستحقاق: {x}",
        TaskReminder = "تذكير بمهمة",
        EventReminder = "تذكير بحدث",
        NoteReminder = "تذكير بملاحظة",
        YourDay = "يومك",
        TasksDueToday = n => Ar(n, "مهمة واحدة", "مهمتان", "مهام", "مهمة", "مهمة") + " مستحقة اليوم",
        Important = n => $" ({n} مهمة)",
        Overdue = n => $"{n} متأخرة",
        Events = n => Ar(n, "حدث واحد", "حدثان", "أحداث", "حدثًا", "حدث"),
    };

    public static readonly NotificationTexts Hindi = new()
    {
        Culture = CultureInfo.GetCultureInfo("hi-IN"),
        Minutes = n => $"{n} मिनट",
        Hours = n => $"{n} घंटे",
        Days = n => $"{n} दिन",
        HoursMinutes = (h, m) => $"{h} घं {m} मि",
        StartingNow = "अभी शुरू हो रहा है",
        StartsIn = x => $"{x} में शुरू होगा",
        DueNow = "अभी करना है",
        DueIn = x => $"{x} में करना है",
        StartsAt = x => $"शुरुआत: {x}",
        DueAt = x => $"आखिरी तारीख: {x}",
        TaskReminder = "काम का रिमाइंडर",
        EventReminder = "इवेंट का रिमाइंडर",
        NoteReminder = "नोट का रिमाइंडर",
        YourDay = "आपका दिन",
        TasksDueToday = n => $"आज {n} काम करने हैं",
        Important = n => $" ({n} ज़रूरी)",
        Overdue = n => $"{n} बाकी रह गए",
        Events = n => $"{n} इवेंट",
    };

    public static readonly NotificationTexts Chinese = new()
    {
        Culture = CultureInfo.GetCultureInfo("zh-CN"),
        Minutes = n => $"{n} 分钟",
        Hours = n => $"{n} 小时",
        Days = n => $"{n} 天",
        HoursMinutes = (h, m) => $"{h} 小时 {m} 分钟",
        StartingNow = "现在开始",
        StartsIn = x => $"{x}后开始",
        DueNow = "现在到期",
        DueIn = x => $"{x}后到期",
        StartsAt = x => $"开始：{x}",
        DueAt = x => $"到期：{x}",
        TaskReminder = "任务提醒",
        EventReminder = "日程提醒",
        NoteReminder = "笔记提醒",
        YourDay = "你的一天",
        TasksDueToday = n => $"今天到期 {n} 个任务",
        Important = n => $"（{n} 个重要）",
        Overdue = n => $"{n} 个已逾期",
        Events = n => $"{n} 个日程",
    };

    public static readonly NotificationTexts Japanese = new()
    {
        Culture = CultureInfo.GetCultureInfo("ja-JP"),
        Minutes = n => $"{n}分",
        Hours = n => $"{n}時間",
        Days = n => $"{n}日",
        HoursMinutes = (h, m) => $"{h}時間{m}分",
        StartingNow = "まもなく開始",
        StartsIn = x => $"{x}後に開始",
        DueNow = "今が期限",
        DueIn = x => $"{x}後に期限",
        StartsAt = x => $"開始：{x}",
        DueAt = x => $"期限：{x}",
        TaskReminder = "タスクのリマインダー",
        EventReminder = "予定のリマインダー",
        NoteReminder = "メモのリマインダー",
        YourDay = "今日の予定",
        TasksDueToday = n => $"今日が期限のタスク {n}件",
        Important = n => $"（重要 {n}件）",
        Overdue = n => $"期限切れ {n}件",
        Events = n => $"予定 {n}件",
    };

    public static readonly NotificationTexts Korean = new()
    {
        Culture = CultureInfo.GetCultureInfo("ko-KR"),
        Minutes = n => $"{n}분",
        Hours = n => $"{n}시간",
        Days = n => $"{n}일",
        HoursMinutes = (h, m) => $"{h}시간 {m}분",
        StartingNow = "지금 시작",
        StartsIn = x => $"{x} 후 시작",
        DueNow = "지금 마감",
        DueIn = x => $"{x} 후 마감",
        StartsAt = x => $"시작: {x}",
        DueAt = x => $"마감: {x}",
        TaskReminder = "할 일 알림",
        EventReminder = "일정 알림",
        NoteReminder = "메모 알림",
        YourDay = "오늘 하루",
        TasksDueToday = n => $"오늘 마감인 할 일 {n}개",
        Important = n => $" (중요 {n}개)",
        Overdue = n => $"기한 지난 것 {n}개",
        Events = n => $"일정 {n}개",
    };
}
