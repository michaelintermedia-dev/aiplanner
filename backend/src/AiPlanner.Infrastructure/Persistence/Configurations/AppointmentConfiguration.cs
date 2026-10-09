using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

/// <summary>An event: a row of the Items table (see ItemBaseConfiguration).</summary>
public class AppointmentConfiguration : IEntityTypeConfiguration<Appointment>
{
    public void Configure(EntityTypeBuilder<Appointment> builder)
    {
        builder.Property(a => a.Title).HasColumnName(ItemColumns.Title).IsRequired().HasMaxLength(300);
        builder.Property(a => a.Description).HasColumnName(ItemColumns.Text);
        builder.Property(a => a.Notes).HasColumnName(ItemColumns.Notes);
        builder.Property(a => a.AiSummary).HasColumnName(ItemColumns.AiSummary);
        builder.Property(a => a.StartUtc).HasColumnName(ItemColumns.DateUtc);
        builder.Property(a => a.Status).HasColumnName(ItemColumns.Status);
        builder.Property(a => a.Priority).HasColumnName(ItemColumns.Priority);
        builder.Property(a => a.Location).HasColumnName(ItemColumns.Location).HasMaxLength(300);
        builder.Property(a => a.RecurrenceRuleId).HasColumnName(ItemColumns.RecurrenceRuleId);
        builder.Property(a => a.SourceAiExtractionId).HasColumnName(ItemColumns.SourceAiExtractionId);
        builder.HasOne(a => a.RecurrenceRule).WithMany().HasForeignKey(a => a.RecurrenceRuleId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne(a => a.SourceAiExtraction).WithMany().HasForeignKey(a => a.SourceAiExtractionId).OnDelete(DeleteBehavior.SetNull);
        builder.HasMany(a => a.Participants).WithOne(p => p.Appointment).HasForeignKey(p => p.AppointmentId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(a => a.Reminders).WithOne(r => r.Appointment).HasForeignKey(r => r.AppointmentId).OnDelete(DeleteBehavior.Cascade);
    }
}
