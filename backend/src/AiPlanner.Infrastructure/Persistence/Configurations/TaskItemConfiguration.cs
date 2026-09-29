using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

public class TaskItemConfiguration : IEntityTypeConfiguration<TaskItem>
{
    public void Configure(EntityTypeBuilder<TaskItem> builder)
    {
        builder.ToTable("TaskItems");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Title).IsRequired().HasMaxLength(300);
        builder.Property(t => t.Description).HasMaxLength(4000);
        builder.Property(t => t.RowVersion).IsRowVersion();
        builder.HasIndex(t => new { t.UserId, t.Status });
        builder.HasIndex(t => new { t.UserId, t.DueDateUtc });

        builder.HasOne(t => t.RecurrenceRule).WithMany().HasForeignKey(t => t.RecurrenceRuleId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne(t => t.SourceAiExtraction).WithMany().HasForeignKey(t => t.SourceAiExtractionId).OnDelete(DeleteBehavior.SetNull);
        builder.HasMany(t => t.Reminders).WithOne(r => r.TaskItem).HasForeignKey(r => r.TaskItemId).OnDelete(DeleteBehavior.Cascade);
    }
}
