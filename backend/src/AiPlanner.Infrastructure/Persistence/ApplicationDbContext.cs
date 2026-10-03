using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Domain.Common;
using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Infrastructure.Persistence;

public class ApplicationDbContext : DbContext, IApplicationDbContext
{
    private readonly ICurrentUserService? _currentUserService;
    private readonly IDateTime? _dateTime;

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        ICurrentUserService? currentUserService = null,
        IDateTime? dateTime = null)
        : base(options)
    {
        _currentUserService = currentUserService;
        _dateTime = dateTime;
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<UserSettings> UserSettings => Set<UserSettings>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public DbSet<TaskItem> TaskItems => Set<TaskItem>();
    public DbSet<Appointment> Appointments => Set<Appointment>();
    public DbSet<AppointmentParticipant> AppointmentParticipants => Set<AppointmentParticipant>();
    public DbSet<Reminder> Reminders => Set<Reminder>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Note> Notes => Set<Note>();

    public DbSet<VoiceCapture> VoiceCaptures => Set<VoiceCapture>();
    public DbSet<Transcript> Transcripts => Set<Transcript>();
    public DbSet<AIExtraction> AIExtractions => Set<AIExtraction>();
    public DbSet<AIExtractionItem> AIExtractionItems => Set<AIExtractionItem>();

    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<TaskTag> TaskTags => Set<TaskTag>();
    public DbSet<RecurrenceRule> RecurrenceRules => Set<RecurrenceRule>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(BaseEntity).IsAssignableFrom(entityType.ClrType))
            {
                var method = typeof(ApplicationDbContext)
                    .GetMethod(nameof(SetSoftDeleteFilter), System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)!
                    .MakeGenericMethod(entityType.ClrType);
                method.Invoke(null, new object[] { modelBuilder });
            }
        }

        base.OnModelCreating(modelBuilder);
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // Every DateTime in this model is UTC, but SQL Server's datetime2 doesn't
        // store a Kind, so values would come back as Unspecified and serialize
        // without the trailing "Z" - clients would then read them as local time.
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
        configurationBuilder.Properties<DateTime?>().HaveConversion<UtcDateTimeConverter>();
    }

    private static void SetSoftDeleteFilter<TEntity>(ModelBuilder modelBuilder) where TEntity : BaseEntity
    {
        modelBuilder.Entity<TEntity>().HasQueryFilter(e => !e.IsDeleted);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = _dateTime?.UtcNow ?? DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAtUtc = now;
                    entry.Entity.UpdatedAtUtc = now;
                    if (entry.Entity.UserId == Guid.Empty && _currentUserService?.UserId is { } uid)
                    {
                        entry.Entity.UserId = uid;
                    }
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAtUtc = now;
                    break;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }

    public Task<T> ExecuteInTransactionAsync<T>(Func<CancellationToken, Task<T>> operation, CancellationToken cancellationToken = default)
    {
        // Already inside one (e.g. a type change while saving a capture): join
        // it, so the whole thing still commits or rolls back together.
        if (Database.CurrentTransaction is not null)
        {
            return operation(cancellationToken);
        }

        // With retry-on-failure enabled, a user-initiated transaction must run
        // inside the execution strategy so a transient failure retries the
        // whole unit rather than half of it.
        var strategy = Database.CreateExecutionStrategy();
        return strategy.ExecuteAsync(async ct =>
        {
            await using var transaction = await Database.BeginTransactionAsync(ct);
            var result = await operation(ct);
            await transaction.CommitAsync(ct);
            return result;
        }, cancellationToken);
    }
}
