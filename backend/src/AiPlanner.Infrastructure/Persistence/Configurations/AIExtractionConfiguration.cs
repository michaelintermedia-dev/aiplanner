using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

public class AIExtractionConfiguration : IEntityTypeConfiguration<AIExtraction>
{
    public void Configure(EntityTypeBuilder<AIExtraction> builder)
    {
        builder.ToTable("AIExtractions");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.RawResponseJson).IsRequired();
        builder.Property(e => e.ProviderName).HasMaxLength(50);
        builder.Property(e => e.ModelName).HasMaxLength(100);
        builder.Property(e => e.RowVersion).IsRowVersion();
        builder.HasMany(e => e.Items).WithOne(i => i.AiExtraction).HasForeignKey(i => i.AiExtractionId).OnDelete(DeleteBehavior.Cascade);
    }
}
