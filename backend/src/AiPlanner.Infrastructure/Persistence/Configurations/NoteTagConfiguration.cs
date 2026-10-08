using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

public class NoteTagConfiguration : IEntityTypeConfiguration<NoteTag>
{
    public void Configure(EntityTypeBuilder<NoteTag> builder)
    {
        builder.ToTable("NoteTags");
        builder.HasKey(x => new { x.NoteId, x.TagId });
        builder.HasOne(x => x.Note).WithMany(i => i.NoteTags).HasForeignKey(x => x.NoteId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(x => x.Tag).WithMany(t => t.NoteTags).HasForeignKey(x => x.TagId).OnDelete(DeleteBehavior.Cascade);
    }
}
