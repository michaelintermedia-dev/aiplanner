using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

public class VoiceCaptureConfiguration : IEntityTypeConfiguration<VoiceCapture>
{
    public void Configure(EntityTypeBuilder<VoiceCapture> builder)
    {
        builder.ToTable("VoiceCaptures");
        builder.HasKey(v => v.Id);
        // Stored as a JSON array; emptied when the user deletes the recording
        // (the transcript is kept).
        builder.Property(v => v.AudioStorageKeys).HasMaxLength(4000);
        builder.Property(v => v.MimeType).HasMaxLength(100);
        builder.Property(v => v.RowVersion).IsRowVersion();
        builder.HasIndex(v => new { v.UserId, v.Status });
        builder.HasOne(v => v.Transcript).WithOne(t => t.VoiceCapture).HasForeignKey<Transcript>(t => t.VoiceCaptureId).OnDelete(DeleteBehavior.Cascade);
    }
}
