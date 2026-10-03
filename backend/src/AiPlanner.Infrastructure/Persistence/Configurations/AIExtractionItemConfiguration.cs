using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

public class AIExtractionItemConfiguration : IEntityTypeConfiguration<AIExtractionItem>
{
    public void Configure(EntityTypeBuilder<AIExtractionItem> builder)
    {
        builder.ToTable("AIExtractionItems");
        builder.OwnsMany(i => i.ProposedReminders, r => r.ToJson());
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Title).IsRequired().HasMaxLength(300);
        builder.Property(i => i.Summary).HasMaxLength(2000);
        builder.Property(i => i.Description).HasMaxLength(4000);
        builder.Property(i => i.Location).HasMaxLength(300);
        builder.Property(i => i.Clarification).HasMaxLength(500);
        builder.Property(i => i.ContinuesItemType).HasMaxLength(20);
        builder.Property(i => i.Unrelated).HasMaxLength(4000);
        builder.Property(i => i.RowVersion).IsRowVersion();
        builder.HasIndex(i => new { i.AiExtractionId, i.Status });
    }
}
