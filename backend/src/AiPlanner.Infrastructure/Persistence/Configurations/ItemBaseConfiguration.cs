using AiPlanner.Domain.Entities;
using AiPlanner.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiPlanner.Infrastructure.Persistence.Configurations;

/// <summary>
/// One "Items" table for tasks, events and notes (see ItemBase): the kind is
/// the "Kind" column, and the three types share the columns for what they have
/// in common (each derived configuration names them).
/// </summary>
public class ItemBaseConfiguration : IEntityTypeConfiguration<ItemBase>
{
    public void Configure(EntityTypeBuilder<ItemBase> builder)
    {
        builder.ToTable("Items");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.RowVersion).IsRowVersion();
        builder.HasDiscriminator<ItemKind>("Kind")
            .HasValue<TaskItem>(ItemKind.Task)
            .HasValue<Appointment>(ItemKind.Event)
            .HasValue<Note>(ItemKind.Note);
        builder.HasIndex(nameof(ItemBase.UserId), "Kind");
    }
}

/// <summary>The columns all three types share, under one name each.</summary>
internal static class ItemColumns
{
    public const string Title = "Title";
    public const string Text = "Text";
    public const string Notes = "Notes";
    public const string AiSummary = "AiSummary";
    public const string DateUtc = "DateUtc";
    public const string Status = "Status";
    public const string Priority = "Priority";
    public const string Location = "Location";
    public const string People = "People";
    public const string RecurrenceRuleId = "RecurrenceRuleId";
    public const string SourceAiExtractionId = "SourceAiExtractionId";
}
