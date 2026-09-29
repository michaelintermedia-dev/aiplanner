using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("Notifications");
        builder.HasKey(n => n.Id);
        builder.Property(n => n.Title).IsRequired().HasMaxLength(300);
        builder.Property(n => n.Body).HasMaxLength(2000);
        builder.Property(n => n.RowVersion).IsRowVersion();
        builder.HasIndex(n => new { n.UserId, n.Status, n.ScheduledForUtc });

        builder.HasOne(n => n.Reminder).WithMany().HasForeignKey(n => n.ReminderId).OnDelete(DeleteBehavior.ClientSetNull);
        builder.HasOne(n => n.TaskItem).WithMany().HasForeignKey(n => n.TaskItemId).OnDelete(DeleteBehavior.ClientSetNull);
        builder.HasOne(n => n.Appointment).WithMany().HasForeignKey(n => n.AppointmentId).OnDelete(DeleteBehavior.ClientSetNull);
    }
}
