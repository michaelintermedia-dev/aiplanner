namespace AiPlanner.Application.Items.DTOs;

/// <summary>Points at one item of any type: "Task", "Appointment" or "Note".</summary>
public record ItemRef(string ItemType, Guid Id);
