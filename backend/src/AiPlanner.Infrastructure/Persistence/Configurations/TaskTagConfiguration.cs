using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

public class TaskTagConfiguration : IEntityTypeConfiguration<TaskTag>
{
    public void Configure(EntityTypeBuilder<TaskTag> builder)
    {
        builder.ToTable("TaskTags");
        builder.HasKey(tt => new { tt.TaskItemId, tt.TagId });
        builder.HasOne(tt => tt.TaskItem).WithMany(t => t.TaskTags).HasForeignKey(tt => tt.TaskItemId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(tt => tt.Tag).WithMany(t => t.TaskTags).HasForeignKey(tt => tt.TagId).OnDelete(DeleteBehavior.Cascade);
    }
}
