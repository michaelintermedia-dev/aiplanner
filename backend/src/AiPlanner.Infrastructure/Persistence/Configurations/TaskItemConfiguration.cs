using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

/// <summary>A task: a row of the Items table (see ItemBaseConfiguration).</summary>
public class TaskItemConfiguration : IEntityTypeConfiguration<TaskItem>
{
    public void Configure(EntityTypeBuilder<TaskItem> builder)
    {
        builder.Property(t => t.Title).HasColumnName(ItemColumns.Title).IsRequired().HasMaxLength(300);
        builder.Property(t => t.Description).HasColumnName(ItemColumns.Text);
        builder.Property(t => t.Notes).HasColumnName(ItemColumns.Notes);
        builder.Property(t => t.AiSummary).HasColumnName(ItemColumns.AiSummary);
        builder.Property(t => t.DueDateUtc).HasColumnName(ItemColumns.DateUtc);
        builder.Property(t => t.HasDueTime).HasColumnName("HasTime");
        builder.Property(t => t.Status).HasColumnName(ItemColumns.Status);
        builder.Property(t => t.Priority).HasColumnName(ItemColumns.Priority);
        builder.Property(t => t.Location).HasColumnName(ItemColumns.Location).HasMaxLength(300);
        builder.Property(t => t.People).HasColumnName(ItemColumns.People);
        builder.Property(t => t.RecurrenceRuleId).HasColumnName(ItemColumns.RecurrenceRuleId);
        builder.Property(t => t.SourceAiExtractionId).HasColumnName(ItemColumns.SourceAiExtractionId);
        builder.HasOne(t => t.RecurrenceRule).WithMany().HasForeignKey(t => t.RecurrenceRuleId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne(t => t.SourceAiExtraction).WithMany().HasForeignKey(t => t.SourceAiExtractionId).OnDelete(DeleteBehavior.SetNull);
        builder.HasMany(t => t.Reminders).WithOne(r => r.TaskItem).HasForeignKey(r => r.TaskItemId).OnDelete(DeleteBehavior.Cascade);
    }
}
