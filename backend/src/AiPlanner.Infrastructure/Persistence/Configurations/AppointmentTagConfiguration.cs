using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

public class AppointmentTagConfiguration : IEntityTypeConfiguration<AppointmentTag>
{
    public void Configure(EntityTypeBuilder<AppointmentTag> builder)
    {
        builder.ToTable("AppointmentTags");
        builder.HasKey(x => new { x.AppointmentId, x.TagId });
        builder.HasOne(x => x.Appointment).WithMany(i => i.AppointmentTags).HasForeignKey(x => x.AppointmentId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(x => x.Tag).WithMany(t => t.AppointmentTags).HasForeignKey(x => x.TagId).OnDelete(DeleteBehavior.Cascade);
    }
}
