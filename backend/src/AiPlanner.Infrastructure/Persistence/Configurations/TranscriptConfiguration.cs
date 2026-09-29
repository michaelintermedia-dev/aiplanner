using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

public class TranscriptConfiguration : IEntityTypeConfiguration<Transcript>
{
    public void Configure(EntityTypeBuilder<Transcript> builder)
    {
        builder.ToTable("Transcripts");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Text).IsRequired();
        builder.Property(t => t.LanguageCode).HasMaxLength(10);
        builder.Property(t => t.ProviderName).HasMaxLength(100);
        builder.Property(t => t.RowVersion).IsRowVersion();
        builder.HasIndex(t => t.VoiceCaptureId).IsUnique();
        builder.HasOne(t => t.AiExtraction).WithOne(e => e.Transcript).HasForeignKey<AIExtraction>(e => e.TranscriptId).OnDelete(DeleteBehavior.SetNull);
    }
}
