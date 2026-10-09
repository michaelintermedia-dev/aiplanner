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

    /// <summary>Every task, event and note (one table; Kind tells them apart).</summary>
    public DbSet<ItemBase> Items => Set<ItemBase>();
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
    public DbSet<AppointmentTag> AppointmentTags => Set<AppointmentTag>();
    public DbSet<NoteTag> NoteTags => Set<NoteTag>();
    public DbSet<RecurrenceRule> RecurrenceRules => Set<RecurrenceRule>();
    public DbSet<Attachment> Attachments => Set<Attachment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Case-insensitive text for the few columns that need it (tag names).
        modelBuilder.HasPostgresExtension("citext");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            // On the root of a hierarchy only (tasks, events and notes share ItemBase's filter).
            if (typeof(BaseEntity).IsAssignableFrom(entityType.ClrType) && entityType.BaseType is null)
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
        // Every DateTime in this model is UTC: written as UTC (timestamptz requires
        // it) and read back marked UTC, so it serializes with the trailing "Z".
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

    public Task<int> ExecuteSqlAsync(FormattableString sql, CancellationToken cancellationToken = default) =>
        Database.ExecuteSqlInterpolatedAsync(sql, cancellationToken);

    public void Detach(IEnumerable<object> entities)
    {
        foreach (var entity in entities) Entry(entity).State = EntityState.Detached;
    }
}
