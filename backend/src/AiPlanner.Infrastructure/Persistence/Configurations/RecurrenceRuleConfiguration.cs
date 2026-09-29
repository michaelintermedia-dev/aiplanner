using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

public class RecurrenceRuleConfiguration : IEntityTypeConfiguration<RecurrenceRule>
{
    public void Configure(EntityTypeBuilder<RecurrenceRule> builder)
    {
        builder.ToTable("RecurrenceRules");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.ByDay).HasMaxLength(50);
        builder.Property(r => r.CustomRuleExpression).HasMaxLength(500);
        builder.Property(r => r.RowVersion).IsRowVersion();
    }
}
