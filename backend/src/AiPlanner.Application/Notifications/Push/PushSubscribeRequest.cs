using FluentValidation;

namespace AiPlanner.Application.Notifications.Push;

/// <summary>POST /api/push/subscriptions - the browser's PushSubscription (endpoint + keys).</summary>
public record PushSubscribeRequest(string Endpoint, string P256dh, string Auth);

public class PushSubscribeRequestValidator : AbstractValidator<PushSubscribeRequest>
{
    public PushSubscribeRequestValidator()
    {
        RuleFor(x => x.Endpoint).NotEmpty().MaximumLength(1000).Must(e => e.StartsWith("https://", StringComparison.Ordinal)).WithMessage("Endpoint must be https.");
        RuleFor(x => x.P256dh).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Auth).NotEmpty().MaximumLength(100);
    }
}
