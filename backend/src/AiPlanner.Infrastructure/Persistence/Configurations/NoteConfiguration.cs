using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

/// <summary>A note: a row of the Items table (see ItemBaseConfiguration).</summary>
public class NoteConfiguration : IEntityTypeConfiguration<Note>
{
    public void Configure(EntityTypeBuilder<Note> builder)
    {
        builder.Property(n => n.Title).HasColumnName(ItemColumns.Title).HasMaxLength(300);
        builder.Property(n => n.Content).HasColumnName(ItemColumns.Text).IsRequired();
        builder.Property(n => n.AiSummary).HasColumnName(ItemColumns.AiSummary);
        builder.Property(n => n.Priority).HasColumnName(ItemColumns.Priority);
        builder.Property(n => n.Location).HasColumnName(ItemColumns.Location).HasMaxLength(300);
        builder.Property(n => n.People).HasColumnName(ItemColumns.People);
        builder.Property(n => n.SourceAiExtractionId).HasColumnName(ItemColumns.SourceAiExtractionId);
        builder.HasMany(n => n.Reminders).WithOne(r => r.Note).HasForeignKey(r => r.NoteId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(n => n.SourceAiExtraction).WithMany().HasForeignKey(n => n.SourceAiExtractionId).OnDelete(DeleteBehavior.SetNull);
    }
}
