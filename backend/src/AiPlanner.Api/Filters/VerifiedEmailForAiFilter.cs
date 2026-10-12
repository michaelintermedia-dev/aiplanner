using AiPlanner.Application.Common.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Api.Filters;

/// <summary>
/// The AI (the endpoints rate-limited as "ai") needs a confirmed email - once the
/// server sends email (production prep, 2026-10-12): unconfirmed throwaway
/// accounts can't spend the AI budget. 403 { code: "email_unconfirmed" }.
/// </summary>
public class VerifiedEmailForAiFilter : IAsyncActionFilter
{
    private readonly IEmailSender _email;
    private readonly ICurrentUserService _currentUser;
    private readonly IApplicationDbContext _db;

    public VerifiedEmailForAiFilter(IEmailSender email, ICurrentUserService currentUser, IApplicationDbContext db)
    {
        _email = email;
        _currentUser = currentUser;
        _db = db;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var usesAi = context.ActionDescriptor.EndpointMetadata.OfType<EnableRateLimitingAttribute>().Any(a => a.PolicyName == "ai");
        if (usesAi && _email.IsConfigured && _currentUser.UserId is { } id)
        {
            var confirmed = await _db.Users.Where(u => u.Id == id).Select(u => u.EmailConfirmed).FirstOrDefaultAsync(context.HttpContext.RequestAborted);
            if (!confirmed)
            {
                context.Result = new ObjectResult(new { errors = new[] { "Confirm your email first - we sent you a code." }, code = "email_unconfirmed" }) { StatusCode = StatusCodes.Status403Forbidden };
                return;
            }
        }
        await next();
    }
}
