using AiPlanner.Domain.Common;

namespace AiPlanner.Domain.Entities;

/// <summary>
/// Tasks, events and notes are one kind of item (user's call, 2026-10-09): one
/// "Items" table, one id for an item's whole life, its kind in the "Kind"
/// column (EF table-per-hierarchy). TaskItem / Appointment / Note are its three
/// faces and share the columns they have in common. Changing an item's type
/// changes that row in place (ItemConversionService) - nothing is copied.
/// </summary>
public abstract class ItemBase : BaseEntity
{
}
