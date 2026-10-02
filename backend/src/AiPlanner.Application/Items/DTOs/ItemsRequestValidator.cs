using FluentValidation;

namespace AiPlanner.Application.Items.DTOs;

public class ItemsRequestValidator : AbstractValidator<ItemsRequest>
{
    public const int MaxItems = 500;
    private static readonly string[] Types = ["Task", "Appointment", "Note"];

    public ItemsRequestValidator()
    {
        RuleFor(x => x.Items).NotEmpty().WithMessage("Select at least one item.");
        RuleFor(x => x.Items.Count).LessThanOrEqualTo(MaxItems).When(x => x.Items is not null).WithMessage($"At most {MaxItems} items at a time.");
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.ItemType).Must(t => Types.Contains(t)).WithMessage("ItemType must be Task, Appointment or Note.");
            item.RuleFor(i => i.Id).NotEmpty();
        });
    }
}
