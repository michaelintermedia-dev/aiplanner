using System.Net;
using System.Text.Json;
using AiPlanner.Application.Common.Exceptions;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Api.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (ValidationException ex)
        {
            await WriteProblemAsync(context, HttpStatusCode.BadRequest, "Validation failed", ex.Errors.Select(e => e.ErrorMessage));
        }
        catch (UnauthorizedAccessException)
        {
            await WriteProblemAsync(context, HttpStatusCode.Forbidden, "You do not have access to this resource.");
        }
        catch (KeyNotFoundException)
        {
            await WriteProblemAsync(context, HttpStatusCode.NotFound, "Resource not found.");
        }
        catch (DbUpdateConcurrencyException)
        {
            // Two clients edited the same record at once (spec section 28 - sync
            // must handle conflicts). RowVersion concurrency tokens make EF Core
            // throw this automatically; the client should re-fetch and retry.
            await WriteProblemAsync(context, HttpStatusCode.Conflict,
                "This item was modified by another device. Reload it and try again.");
        }
        catch (AiProviderException ex)
        {
            // AI/speech provider failed (spec section 36). The message is generic by
            // construction; provider details are only in the log.
            _logger.LogWarning(ex, "AI provider failure processing {Method} {Path}", context.Request.Method, context.Request.Path);
            await WriteProblemAsync(context, HttpStatusCode.BadGateway, "The AI service is unavailable right now. Please try again.", [ex.Message]);
        }
        catch (DbUpdateException ex)
        {
            // SQL Server's error text quotes the value that failed (e.g. "Truncated value: '...'"),
            // which can be the user's words - never log it (spec section 37). The kind is enough.
            _logger.LogError("Saving failed processing {Method} {Path}: {Error} ({Inner}, SQL error {Number})",
                context.Request.Method, context.Request.Path, ex.GetType().Name, ex.InnerException?.GetType().Name,
                (ex.InnerException as System.Data.Common.DbException)?.ErrorCode);
            await WriteProblemAsync(context, HttpStatusCode.InternalServerError, "An unexpected error occurred.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception processing {Method} {Path}", context.Request.Method, context.Request.Path);
            await WriteProblemAsync(context, HttpStatusCode.InternalServerError, "An unexpected error occurred.");
        }
    }

    private static async Task WriteProblemAsync(HttpContext context, HttpStatusCode status, string title, IEnumerable<string>? errors = null)
    {
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)status;

        var payload = new
        {
            title,
            status = (int)status,
            errors = errors ?? Enumerable.Empty<string>()
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(payload));
    }
}
