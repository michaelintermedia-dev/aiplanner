using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.ToTable("RefreshTokens");
        builder.HasKey(rt => rt.Id);
        builder.Property(rt => rt.TokenHash).IsRequired().HasMaxLength(512);
        builder.HasIndex(rt => rt.TokenHash).IsUnique();
        builder.Property(rt => rt.DeviceInfo).HasMaxLength(200);
        builder.HasIndex(rt => rt.UserId);
    }
}
