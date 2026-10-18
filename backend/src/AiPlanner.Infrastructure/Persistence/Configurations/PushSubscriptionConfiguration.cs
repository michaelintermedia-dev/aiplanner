using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

public class PushSubscriptionConfiguration : IEntityTypeConfiguration<PushSubscription>
{
    public void Configure(EntityTypeBuilder<PushSubscription> builder)
    {
        builder.ToTable("PushSubscriptions");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Endpoint).IsRequired().HasMaxLength(1000);
        builder.Property(s => s.P256dh).IsRequired().HasMaxLength(200);
        builder.Property(s => s.Auth).IsRequired().HasMaxLength(100);
        builder.HasIndex(s => s.Endpoint).IsUnique();
        builder.HasIndex(s => s.UserId);
        builder.HasOne<User>().WithMany().HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
