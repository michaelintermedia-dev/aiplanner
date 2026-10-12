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

    public static readonly ClarificationTexts Spanish = new()
    {
        WhenIsAppointment = "¿Cuándo es este evento?",
        WhatTimeStarts = "¿A qué hora empieza?",
        TimePassed = "Esta hora ya pasó - revisa la fecha.",
        WhatTimeRemind = "¿A qué hora te lo recuerdo?",
        WhenRemind = "¿Cuándo te lo recuerdo?",
        ReminderPassed = "La hora de este recordatorio ya pasó - revísala.",
        WhichDays = "¿Qué días te lo recuerdo?",
        CheckDate = "Revisa la fecha.",
        DefaultCaptureTitle = "Captura",
        DefaultNoteTitle = "Nota",
        MediaPhoto = "Foto",
        MediaPdf = "PDF",
        MediaDocument = "Documento",
    };

    public static readonly ClarificationTexts French = new()
    {
        WhenIsAppointment = "Quand a lieu cet événement ?",
        WhatTimeStarts = "À quelle heure commence-t-il ?",
        TimePassed = "Cette heure est déjà passée - vérifiez la date.",
        WhatTimeRemind = "À quelle heure dois-je vous le rappeler ?",
        WhenRemind = "Quand dois-je vous le rappeler ?",
        ReminderPassed = "L’heure de ce rappel est déjà passée - vérifiez-la.",
        WhichDays = "Quels jours dois-je vous le rappeler ?",
        CheckDate = "Vérifiez la date.",
        DefaultCaptureTitle = "Saisie",
        DefaultNoteTitle = "Note",
        MediaPhoto = "Photo",
        MediaPdf = "PDF",
        MediaDocument = "Document",
    };

    public static readonly ClarificationTexts German = new()
    {
        WhenIsAppointment = "Wann ist dieser Termin?",
        WhatTimeStarts = "Um wie viel Uhr beginnt er?",
        TimePassed = "Diese Uhrzeit ist schon vorbei - bitte prüfe das Datum.",
        WhatTimeRemind = "Um wie viel Uhr soll ich dich erinnern?",
        WhenRemind = "Wann soll ich dich erinnern?",
        ReminderPassed = "Die Zeit dieser Erinnerung ist schon vorbei - bitte prüfe sie.",
        WhichDays = "An welchen Tagen soll ich dich erinnern?",
        CheckDate = "Bitte prüfe das Datum.",
        DefaultCaptureTitle = "Eingabe",
        DefaultNoteTitle = "Notiz",
        MediaPhoto = "Foto",
        MediaPdf = "PDF",
        MediaDocument = "Dokument",
    };

    public static readonly ClarificationTexts Portuguese = new()
    {
        WhenIsAppointment = "Quando é este evento?",
        WhatTimeStarts = "A que horas começa?",
        TimePassed = "Esse horário já passou - confira a data.",
        WhatTimeRemind = "A que horas devo lembrar você?",
        WhenRemind = "Quando devo lembrar você?",
        ReminderPassed = "O horário deste lembrete já passou - confira.",
        WhichDays = "Em quais dias devo lembrar você?",
        CheckDate = "Confira a data.",
        DefaultCaptureTitle = "Anotação",
        DefaultNoteTitle = "Nota",
        MediaPhoto = "Foto",
        MediaPdf = "PDF",
        MediaDocument = "Documento",
    };

    public static readonly ClarificationTexts Italian = new()
    {
        WhenIsAppointment = "Quando è questo evento?",
        WhatTimeStarts = "A che ora inizia?",
        TimePassed = "Quest’ora è già passata - controlla la data.",
        WhatTimeRemind = "A che ora te lo ricordo?",
        WhenRemind = "Quando te lo ricordo?",
        ReminderPassed = "L’ora di questo promemoria è già passata - controllala.",
        WhichDays = "In quali giorni te lo ricordo?",
        CheckDate = "Controlla la data.",
        DefaultCaptureTitle = "Appunto",
        DefaultNoteTitle = "Nota",
        MediaPhoto = "Foto",
        MediaPdf = "PDF",
        MediaDocument = "Documento",
    };

    public static readonly ClarificationTexts Polish = new()
    {
        WhenIsAppointment = "Kiedy jest to wydarzenie?",
        WhatTimeStarts = "O której się zaczyna?",
        TimePassed = "Ta godzina już minęła - sprawdź datę.",
        WhatTimeRemind = "O której mam przypomnieć?",
        WhenRemind = "Kiedy mam przypomnieć?",
        ReminderPassed = "Czas tego przypomnienia już minął - sprawdź go.",
        WhichDays = "W które dni mam przypominać?",
        CheckDate = "Sprawdź datę.",
        DefaultCaptureTitle = "Wpis",
        DefaultNoteTitle = "Notatka",
        MediaPhoto = "Zdjęcie",
        MediaPdf = "PDF",
        MediaDocument = "Dokument",
    };

    public static readonly ClarificationTexts Romanian = new()
    {
        WhenIsAppointment = "Când este acest eveniment?",
        WhatTimeStarts = "La ce oră începe?",
        TimePassed = "Ora aceasta a trecut deja - verifică data.",
        WhatTimeRemind = "La ce oră să-ți amintesc?",
        WhenRemind = "Când să-ți amintesc?",
        ReminderPassed = "Ora acestui memento a trecut deja - verific-o.",
        WhichDays = "În ce zile să-ți amintesc?",
        CheckDate = "Verifică data.",
        DefaultCaptureTitle = "Notare",
        DefaultNoteTitle = "Notiță",
        MediaPhoto = "Poză",
        MediaPdf = "PDF",
        MediaDocument = "Document",
    };

    public static readonly ClarificationTexts Ukrainian = new()
    {
        WhenIsAppointment = "Коли ця подія?",
        WhatTimeStarts = "О котрій вона починається?",
        TimePassed = "Цей час уже минув — перевірте дату.",
        WhatTimeRemind = "О котрій нагадати?",
        WhenRemind = "Коли нагадати?",
        ReminderPassed = "Час нагадування вже минув — перевірте його.",
        WhichDays = "У які дні нагадувати?",
        CheckDate = "Перевірте дату.",
        DefaultCaptureTitle = "Запис",
        DefaultNoteTitle = "Нотатка",
        MediaPhoto = "Фото",
        MediaPdf = "PDF",
        MediaDocument = "Документ",
    };

    public static readonly ClarificationTexts Turkish = new()
    {
        WhenIsAppointment = "Bu etkinlik ne zaman?",
        WhatTimeStarts = "Saat kaçta başlıyor?",
        TimePassed = "Bu saat geçti - lütfen tarihi kontrol edin.",
        WhatTimeRemind = "Saat kaçta hatırlatayım?",
        WhenRemind = "Ne zaman hatırlatayım?",
        ReminderPassed = "Bu hatırlatıcının saati geçti - lütfen kontrol edin.",
        WhichDays = "Hangi günler hatırlatayım?",
        CheckDate = "Lütfen tarihi kontrol edin.",
        DefaultCaptureTitle = "Kayıt",
        DefaultNoteTitle = "Not",
        MediaPhoto = "Fotoğraf",
        MediaPdf = "PDF",
        MediaDocument = "Belge",
    };

    public static readonly ClarificationTexts Arabic = new()
    {
        WhenIsAppointment = "متى هذا الحدث؟",
        WhatTimeStarts = "في أي ساعة يبدأ؟",
        TimePassed = "هذا الوقت مضى بالفعل - تحقق من التاريخ.",
        WhatTimeRemind = "في أي ساعة أذكّرك؟",
        WhenRemind = "متى أذكّرك؟",
        ReminderPassed = "وقت هذا التذكير مضى بالفعل - تحقق منه.",
        WhichDays = "في أي أيام أذكّرك؟",
        CheckDate = "تحقق من التاريخ.",
        DefaultCaptureTitle = "تسجيل",
        DefaultNoteTitle = "ملاحظة",
        MediaPhoto = "صورة",
        MediaPdf = "PDF",
        MediaDocument = "مستند",
    };

    public static readonly ClarificationTexts Hindi = new()
    {
        WhenIsAppointment = "यह इवेंट कब है?",
        WhatTimeStarts = "यह कितने बजे शुरू होता है?",
        TimePassed = "यह समय बीत चुका है - तारीख जाँच लें।",
        WhatTimeRemind = "कितने बजे याद दिलाऊँ?",
        WhenRemind = "कब याद दिलाऊँ?",
        ReminderPassed = "इस रिमाइंडर का समय बीत चुका है - इसे जाँच लें।",
        WhichDays = "किन दिनों याद दिलाऊँ?",
        CheckDate = "तारीख जाँच लें।",
        DefaultCaptureTitle = "एंट्री",
        DefaultNoteTitle = "नोट",
        MediaPhoto = "फ़ोटो",
        MediaPdf = "PDF",
        MediaDocument = "दस्तावेज़",
    };

    public static readonly ClarificationTexts Chinese = new()
    {
        WhenIsAppointment = "这个日程是什么时候？",
        WhatTimeStarts = "几点开始？",
        TimePassed = "这个时间已经过了 - 请检查日期。",
        WhatTimeRemind = "几点提醒你？",
        WhenRemind = "什么时候提醒你？",
        ReminderPassed = "这个提醒的时间已经过了 - 请检查。",
        WhichDays = "哪几天提醒你？",
        CheckDate = "请检查日期。",
        DefaultCaptureTitle = "记录",
        DefaultNoteTitle = "笔记",
        MediaPhoto = "照片",
        MediaPdf = "PDF",
        MediaDocument = "文档",
    };

    public static readonly ClarificationTexts Japanese = new()
    {
        WhenIsAppointment = "この予定はいつですか？",
        WhatTimeStarts = "何時に始まりますか？",
        TimePassed = "この時刻はもう過ぎています - 日付を確認してください。",
        WhatTimeRemind = "何時にお知らせしますか？",
        WhenRemind = "いつお知らせしますか？",
        ReminderPassed = "このリマインダーの時刻はもう過ぎています - 確認してください。",
        WhichDays = "何曜日にお知らせしますか？",
        CheckDate = "日付を確認してください。",
        DefaultCaptureTitle = "記録",
        DefaultNoteTitle = "メモ",
        MediaPhoto = "写真",
        MediaPdf = "PDF",
        MediaDocument = "文書",
    };

    public static readonly ClarificationTexts Korean = new()
    {
        WhenIsAppointment = "이 일정은 언제인가요?",
        WhatTimeStarts = "몇 시에 시작하나요?",
        TimePassed = "이 시간은 이미 지났습니다 - 날짜를 확인하세요.",
        WhatTimeRemind = "몇 시에 알려 드릴까요?",
        WhenRemind = "언제 알려 드릴까요?",
        ReminderPassed = "이 알림 시간은 이미 지났습니다 - 확인하세요.",
        WhichDays = "어느 요일에 알려 드릴까요?",
        CheckDate = "날짜를 확인하세요.",
        DefaultCaptureTitle = "기록",
        DefaultNoteTitle = "메모",
        MediaPhoto = "사진",
        MediaPdf = "PDF",
        MediaDocument = "문서",
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

    // "When", "what time", "which day" and the like, in the apps' languages.
    private static readonly System.Text.RegularExpressions.Regex AboutTime = new(
        @"\b(when|what time|which day|what day|date|time)\b|когда|во сколько|в котор|какого числа|время|дат|מתי|שעה|תאריך|באיזה יום"
        + @"|cuándo|qué hora|qué día|fecha|quand|quelle heure|quel jour|wann|uhrzeit|welche[mn]? tag|datum|quando|que horas|que dia|che ora|che giorno|data"
        + @"|când|ce oră|ce zi|kiedy|o której|któr\w* dzień|godzin|коли|о котрій|котр\w* дн|годин|ne zaman|saat kaç|hangi gün|tarih"
        + @"|متى|أي ساعة|أي يوم|تاريخ|الوقت|कब|कितने बजे|किस दिन|तारीख|समय|什么时候|几点|哪天|日期|时间|いつ|何時|何日|日付|時刻|언제|몇 시|무슨 요일|날짜|시간",
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
