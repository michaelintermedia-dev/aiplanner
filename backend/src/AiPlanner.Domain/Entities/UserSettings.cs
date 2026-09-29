namespace AiPlanner.Domain.Entities;

public class UserSettings
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;

    public bool NotificationsEnabled { get; set; } = true;
    public int DefaultReminderMinutesBefore { get; set; } = 30;
    public bool DailySummaryEnabled { get; set; } = true;
    public TimeSpan DailySummaryTime { get; set; } = new TimeSpan(8, 0, 0);
    public bool TaskRemindersEnabled { get; set; } = true;
    public bool AppointmentRemindersEnabled { get; set; } = true;

    public bool AiProcessingEnabled { get; set; } = true;
    public bool ReviewBeforeSave { get; set; } = true;
    public bool AutomaticProcessing { get; set; } = true;

    public string Theme { get; set; } = "System";
    public string DateFormat { get; set; } = "yyyy-MM-dd";
    public string TimeFormat { get; set; } = "HH:mm";

    public bool RetainAudioAfterTranscription { get; set; } = false;
    public int TranscriptRetentionDays { get; set; } = 90;

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
