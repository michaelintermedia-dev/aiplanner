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
            "([TaskItemId] IS NOT NULL AND [AppointmentId] IS NULL) OR ([TaskItemId] IS NULL AND [AppointmentId] IS NOT NULL)"));
        builder.HasKey(r => r.Id);
        builder.Property(r => r.RowVersion).IsRowVersion();
        builder.HasIndex(r => new { r.UserId, r.TriggerAtUtc });
    }
}
