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
    /// <summary>Unused: the capture bar's Save / Review buttons decide (2026-10-08).</summary>
    public bool ReviewBeforeSave { get; set; } = true;
    /// <summary>Everything in one message becomes ONE item (user's rule) - the AI never splits it.</summary>
    public bool OneEntryPerMessage { get; set; } = true;
    /// <summary>The default of the review's "Keep the recording" (and what the smart Save does).</summary>
    public bool KeepRecordings { get; set; } = true;
    public bool AutomaticProcessing { get; set; } = true;

    /// <summary>"System" (follow the device), "Light" or "Dark" - Settings - Appearance, on every device.</summary>
    public string Theme { get; set; } = "System";
    /// <summary>The colour scheme: AppearanceSettingsDto.Skins.</summary>
    public string Skin { get; set; } = "Indigo";
    /// <summary>Show the skin's wallpaper behind the content (off = a plain background).</summary>
    public bool Wallpaper { get; set; } = true;
    /// <summary>The user's own wallpaper photo (storage key), shown instead of the skin's while Wallpaper is on.</summary>
    public string? WallpaperPhotoKey { get; set; }
    public string DateFormat { get; set; } = "yyyy-MM-dd";
    public string TimeFormat { get; set; } = "HH:mm";

    public bool RetainAudioAfterTranscription { get; set; } = false;
    /// <summary>Cut pauses longer than a second out of saved recordings (PauseTrimmer). Off by default - it can't be undone.</summary>
    public bool ShortenPauses { get; set; }
    public int TranscriptRetentionDays { get; set; } = 90;

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
