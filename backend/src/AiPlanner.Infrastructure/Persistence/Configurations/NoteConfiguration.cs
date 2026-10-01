using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

public class NoteConfiguration : IEntityTypeConfiguration<Note>
{
    public void Configure(EntityTypeBuilder<Note> builder)
    {
        builder.ToTable("Notes");
        builder.HasKey(n => n.Id);
        builder.Property(n => n.Title).HasMaxLength(300);
        builder.Property(n => n.Content).IsRequired();
        builder.Property(n => n.RowVersion).IsRowVersion();
        builder.HasMany(n => n.Reminders).WithOne(r => r.Note).HasForeignKey(r => r.NoteId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(n => n.SourceAiExtraction).WithMany().HasForeignKey(n => n.SourceAiExtractionId).OnDelete(DeleteBehavior.SetNull);
    }
}
