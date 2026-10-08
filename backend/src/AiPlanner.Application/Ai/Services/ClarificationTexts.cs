namespace AiPlanner.Application.Ai.Services;

/// <summary>
/// The questions the server adds to a proposed item when the AI's answer is
/// incomplete or doesn't add up, in the user's language (User.Locale), like
/// NotificationTexts. Unknown languages get English.
/// </summary>
public sealed class ClarificationTexts
{
    public required string WhenIsAppointment { get; init; }
    public required string WhatTimeStarts { get; init; }
    public required string TimePassed { get; init; }
    public required string WhatTimeRemind { get; init; }
    public required string WhenRemind { get; init; }
    public required string ReminderPassed { get; init; }
    public required string WhichDays { get; init; }
    public required string CheckDate { get; init; }
    public required string DefaultCaptureTitle { get; init; }
    public required string DefaultNoteTitle { get; init; }
    // What a capture of only files is, named first in its title (MediaTitles).
    public required string MediaPhoto { get; init; }
    public required string MediaPdf { get; init; }
    public required string MediaDocument { get; init; }

    public static ClarificationTexts For(string? locale) =>
        (locale ?? "").Split('-', '_')[0].ToLowerInvariant() switch
        {
            "ru" => Russian,
            "he" or "iw" => Hebrew,
            _ => English,
        };

    public static readonly ClarificationTexts English = new()
    {
        WhenIsAppointment = "When is this appointment?",
        WhatTimeStarts = "What time does it start?",
        TimePassed = "This time has already passed - please check the date.",
        WhatTimeRemind = "What time should I remind you?",
        WhenRemind = "When should I remind you?",
        ReminderPassed = "This reminder time has already passed - please check it.",
        WhichDays = "Which days should I remind you?",
        CheckDate = "Please check the date.",
        DefaultCaptureTitle = "Capture",
        DefaultNoteTitle = "Note",
        MediaPhoto = "Photo",
        MediaPdf = "PDF",
        MediaDocument = "Document",
    };

    public static readonly ClarificationTexts Russian = new()
    {
        WhenIsAppointment = "Когда это событие?",
        WhatTimeStarts = "Во сколько оно начинается?",
        TimePassed = "Это время уже прошло — проверьте дату.",
        WhatTimeRemind = "Во сколько напомнить?",
        WhenRemind = "Когда напомнить?",
        ReminderPassed = "Время напоминания уже прошло — проверьте его.",
        WhichDays = "По каким дням напоминать?",
        CheckDate = "Проверьте дату.",
        DefaultCaptureTitle = "Запись",
        DefaultNoteTitle = "Заметка",
        MediaPhoto = "Фото",
        MediaPdf = "PDF",
        MediaDocument = "Документ",
    };

    public static readonly ClarificationTexts Hebrew = new()
    {
        WhenIsAppointment = "מתי האירוע הזה?",
        WhatTimeStarts = "באיזו שעה הוא מתחיל?",
        TimePassed = "השעה הזו כבר עברה - כדאי לבדוק את התאריך.",
        WhatTimeRemind = "באיזו שעה להזכיר?",
        WhenRemind = "מתי להזכיר?",
        ReminderPassed = "זמן התזכורת כבר עבר - כדאי לבדוק אותו.",
        WhichDays = "באילו ימים להזכיר?",
        CheckDate = "כדאי לבדוק את התאריך.",
        DefaultCaptureTitle = "רישום",
        DefaultNoteTitle = "פתק",
        MediaPhoto = "תמונה",
        MediaPdf = "PDF",
        MediaDocument = "מסמך",
    };
}

/// <summary>
/// The questions collected for one item. Generic "when / what time?" questions
/// are skipped when the AI already asked about the time or date (it would be the
/// same question twice); other AI questions ("Which Sarah?") don't stop them.
/// Warnings (a time that has passed) always count.
/// </summary>
public sealed class Questions(ClarificationTexts texts)
{
    private readonly List<string> _items = [];
    private bool _providerAsksWhen;

    // "When", "what time", "which day" and the like, in English, Russian and Hebrew.
    private static readonly System.Text.RegularExpressions.Regex AboutTime = new(
        @"\b(when|what time|which day|what day|date|time)\b|когда|во сколько|в котор|какого числа|время|дат|מתי|שעה|תאריך|באיזה יום",
        System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.CultureInvariant);

    public ClarificationTexts Texts { get; } = texts;
    public int Count => _items.Count;

    public void FromProvider(string question)
    {
        _items.Add(question);
        _providerAsksWhen |= AboutTime.IsMatch(question);
    }

    /// <summary>A generic when/what-time question - only when the AI didn't already ask about the time.</summary>
    public void Ask(string question)
    {
        if (!_providerAsksWhen) _items.Add(question);
    }

    /// <summary>Something the user must check, whatever the AI asked.</summary>
    public void Warn(string warning) => _items.Add(warning);

    public IEnumerable<string> Distinct() => _items.Distinct();
}
