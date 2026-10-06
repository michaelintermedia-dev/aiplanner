using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

public class TagConfiguration : IEntityTypeConfiguration<Tag>
{
    public void Configure(EntityTypeBuilder<Tag> builder)
    {
        builder.ToTable("Tags");
        builder.HasKey(t => t.Id);
        // Case-insensitive (citext), as tags always were: "Home" and "home" are one tag.
        builder.Property(t => t.Name).IsRequired().HasMaxLength(100).HasColumnType("citext");
        builder.Property(t => t.ColorHex).HasMaxLength(9);
        builder.Property(t => t.RowVersion).IsRowVersion();
        builder.HasIndex(t => new { t.UserId, t.Name }).IsUnique();
    }
}
