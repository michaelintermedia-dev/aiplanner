using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("Users");
        builder.HasKey(u => u.Id);
        builder.Property(u => u.Email).IsRequired().HasMaxLength(256);
        builder.HasIndex(u => u.Email).IsUnique();
        builder.Property(u => u.DisplayName).IsRequired().HasMaxLength(100);
        builder.Property(u => u.PasswordHash).IsRequired();
        builder.Property(u => u.TimeZoneId).IsRequired().HasMaxLength(100);
        builder.Property(u => u.Locale).IsRequired().HasMaxLength(20);
        builder.Property(u => u.RowVersion).IsRowVersion();

        builder.HasOne(u => u.Settings).WithOne(s => s.User).HasForeignKey<UserSettings>(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(u => u.RefreshTokens).WithOne(rt => rt.User).HasForeignKey(rt => rt.UserId).OnDelete(DeleteBehavior.Cascade);
        builder.HasQueryFilter(u => !u.IsDeleted);
    }
}
