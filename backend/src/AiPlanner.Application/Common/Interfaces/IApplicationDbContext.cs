using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<User> Users { get; }
    DbSet<UserSettings> UserSettings { get; }
    DbSet<RefreshToken> RefreshTokens { get; }

    DbSet<TaskItem> TaskItems { get; }
    DbSet<Appointment> Appointments { get; }
    DbSet<AppointmentParticipant> AppointmentParticipants { get; }
    DbSet<Reminder> Reminders { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<Note> Notes { get; }

    DbSet<VoiceCapture> VoiceCaptures { get; }
    DbSet<Transcript> Transcripts { get; }
    DbSet<AIExtraction> AIExtractions { get; }
    DbSet<AIExtractionItem> AIExtractionItems { get; }

    DbSet<Tag> Tags { get; }
    DbSet<TaskTag> TaskTags { get; }
    DbSet<RecurrenceRule> RecurrenceRules { get; }
    DbSet<Attachment> Attachments { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Runs <paramref name="operation"/> in one database transaction, so every
    /// SaveChangesAsync inside it commits or rolls back together. Works with the
    /// connection's retry-on-failure strategy (the whole operation is retried).
    /// </summary>
    Task<T> ExecuteInTransactionAsync<T>(Func<CancellationToken, Task<T>> operation, CancellationToken cancellationToken = default);
}
