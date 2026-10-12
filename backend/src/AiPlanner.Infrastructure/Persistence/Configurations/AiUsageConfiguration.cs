using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

public class AiUsageConfiguration : IEntityTypeConfiguration<AiUsage>
{
    public void Configure(EntityTypeBuilder<AiUsage> builder)
    {
        builder.ToTable("AiUsage");
        builder.HasKey(u => u.Id);
        builder.Property(u => u.Model).IsRequired().HasMaxLength(100);
        builder.HasIndex(u => new { u.UserId, u.AtUtc });
        builder.HasIndex(u => u.AtUtc);
    }
}
