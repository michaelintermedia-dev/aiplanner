using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

public class AppointmentParticipantConfiguration : IEntityTypeConfiguration<AppointmentParticipant>
{
    public void Configure(EntityTypeBuilder<AppointmentParticipant> builder)
    {
        builder.ToTable("AppointmentParticipants");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Name).IsRequired().HasMaxLength(200);
        builder.Property(p => p.Email).HasMaxLength(256);
    }
}
