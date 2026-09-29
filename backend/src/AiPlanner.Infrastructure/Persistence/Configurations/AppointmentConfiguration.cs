using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

public class AppointmentConfiguration : IEntityTypeConfiguration<Appointment>
{
    public void Configure(EntityTypeBuilder<Appointment> builder)
    {
        builder.ToTable("Appointments");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Title).IsRequired().HasMaxLength(300);
        builder.Property(a => a.Location).HasMaxLength(300);
        builder.Property(a => a.RowVersion).IsRowVersion();
        builder.HasIndex(a => new { a.UserId, a.StartUtc });

        builder.HasOne(a => a.RecurrenceRule).WithMany().HasForeignKey(a => a.RecurrenceRuleId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne(a => a.SourceAiExtraction).WithMany().HasForeignKey(a => a.SourceAiExtractionId).OnDelete(DeleteBehavior.SetNull);
        builder.HasMany(a => a.Participants).WithOne(p => p.Appointment).HasForeignKey(p => p.AppointmentId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(a => a.Reminders).WithOne(r => r.Appointment).HasForeignKey(r => r.AppointmentId).OnDelete(DeleteBehavior.Cascade);
    }
}
