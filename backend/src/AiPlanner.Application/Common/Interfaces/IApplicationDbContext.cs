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

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
