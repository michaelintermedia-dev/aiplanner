using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

public class ExternalLoginConfiguration : IEntityTypeConfiguration<ExternalLogin>
{
    public void Configure(EntityTypeBuilder<ExternalLogin> builder)
    {
        builder.ToTable("ExternalLogins");
        builder.HasKey(l => l.Id);
        builder.Property(l => l.Provider).IsRequired().HasMaxLength(20);
        builder.Property(l => l.Subject).IsRequired().HasMaxLength(255);
        builder.Property(l => l.Email).HasMaxLength(256);
        builder.HasIndex(l => new { l.Provider, l.Subject }).IsUnique();
        builder.HasIndex(l => l.UserId);
        builder.HasOne(l => l.User).WithMany().HasForeignKey(l => l.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
