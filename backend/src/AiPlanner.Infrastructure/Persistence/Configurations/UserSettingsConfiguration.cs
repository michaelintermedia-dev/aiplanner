using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

public class UserSettingsConfiguration : IEntityTypeConfiguration<UserSettings>
{
    public void Configure(EntityTypeBuilder<UserSettings> builder)
    {
        builder.ToTable("UserSettings");
        builder.HasKey(s => s.Id);
        builder.HasIndex(s => s.UserId).IsUnique();
        builder.Property(s => s.Theme).HasMaxLength(20);
        builder.Property(s => s.DateFormat).HasMaxLength(30);
        builder.Property(s => s.TimeFormat).HasMaxLength(30);
    }
}
