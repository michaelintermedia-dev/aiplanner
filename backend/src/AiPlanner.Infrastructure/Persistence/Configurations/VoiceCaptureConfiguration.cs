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
        builder.Property(v => v.AudioStorageKey).IsRequired().HasMaxLength(1000);
        builder.Property(v => v.MimeType).HasMaxLength(100);
        builder.Property(v => v.RowVersion).IsRowVersion();
        builder.HasIndex(v => new { v.UserId, v.Status });
        builder.HasOne(v => v.Transcript).WithOne(t => t.VoiceCapture).HasForeignKey<Transcript>(t => t.VoiceCaptureId).OnDelete(DeleteBehavior.Cascade);
    }
}
