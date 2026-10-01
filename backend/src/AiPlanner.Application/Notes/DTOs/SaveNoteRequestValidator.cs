using FluentValidation;

namespace AiPlanner.Application.Notes.DTOs;

public class SaveNoteRequestValidator : AbstractValidator<SaveNoteRequest>
{
    public SaveNoteRequestValidator()
    {
        RuleFor(x => x.Title).MaximumLength(300);
        RuleFor(x => x.Content).NotEmpty().MaximumLength(20_000);
    }
}
