using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

public class ReminderConfiguration : IEntityTypeConfiguration<Reminder>
{
    public void Configure(EntityTypeBuilder<Reminder> builder)
    {
        builder.ToTable("Reminders", t => t.HasCheckConstraint(
            "CK_Reminders_ExactlyOneParent",
            "num_nonnulls(\"TaskItemId\", \"AppointmentId\", \"NoteId\") = 1"));
        builder.HasKey(r => r.Id);
        builder.Property(r => r.RowVersion).IsRowVersion();
        builder.HasIndex(r => new { r.UserId, r.TriggerAtUtc });
    }
}
