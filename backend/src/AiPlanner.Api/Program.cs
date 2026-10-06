using System.Text;
using System.Text.Json.Serialization;
using AiPlanner.Api.Filters;
using AiPlanner.Api.Middleware;
using AiPlanner.Application;
using AiPlanner.Infrastructure;
using AiPlanner.Infrastructure.Identity;
using AiPlanner.Infrastructure.Persistence;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

// ---- Aspire: telemetry, health checks, service discovery, resilient HttpClients ----
builder.AddServiceDefaults();

// ---- Services -------------------------------------------------------------

builder.Services
    .AddControllers(o => o.Filters.Add<ValidationFilter>())
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

// The "aiplannerdb" connection string is injected by AiPlanner.AppHost when run
// through Aspire, or read from ConnectionStrings:aiplannerdb in appsettings.json
// when run directly.
//
// Registered with plain AddDbContext (not Aspire's AddNpgsqlDbContext, which
// pools contexts): ApplicationDbContext depends on the scoped ICurrentUserService,
// and a pooled context would be created from the root provider and could carry
// one request's user into another. EnrichNpgsqlDbContext then layers on
// Aspire's retry-on-failure, health checks, and OTel instrumentation.
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("aiplannerdb")));
builder.EnrichNpgsqlDbContext<ApplicationDbContext>();

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

var jwtSettings = builder.Configuration.GetSection("Jwt").Get<JwtSettings>()
    ?? throw new InvalidOperationException("Jwt configuration section is missing.");

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidAudience = jwtSettings.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Secret)),
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

builder.Services.AddAuthorization();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("ClientApps", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Behind a reverse proxy (Caddy) in production: trust its X-Forwarded-* headers,
// so the real client IP (rate limits) and scheme (https) are seen.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear(); // the proxy is on the container network
    options.KnownProxies.Clear();
});

// Rate limits (429): sign-in/up/refresh per IP; AI calls (captures) per user -
// a burst window and a daily cap, so a leaked account can't run up the AI bill.
var limits = builder.Configuration.GetSection("RateLimits");
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, ct) =>
        await context.HttpContext.Response.WriteAsJsonAsync(new { errors = new[] { "Too many requests - please wait a moment and try again." } }, ct);

    options.AddPolicy("auth", http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = limits.GetValue("AuthPerMinute", 20), Window = TimeSpan.FromMinutes(1) }));

    static string UserKey(HttpContext http) =>
        http.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? http.User.FindFirstValue("sub") ?? http.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    // AI endpoints: a burst window per user...
    options.AddPolicy("ai", http => RateLimitPartition.GetSlidingWindowLimiter(UserKey(http), _ => new SlidingWindowRateLimiterOptions
    {
        PermitLimit = limits.GetValue("AiPerTenMinutes", 30), Window = TimeSpan.FromMinutes(10), SegmentsPerWindow = 10,
    }));

    // ...and a daily cap per user, counting only the AI endpoints.
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(http =>
        http.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName == "ai"
            ? RateLimitPartition.GetFixedWindowLimiter("day:" + UserKey(http), _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = limits.GetValue("AiPerDay", 200), Window = TimeSpan.FromDays(1),
            })
            : RateLimitPartition.GetNoLimiter("none"));
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "AI Planner API", Version = "v1" });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter a valid JWT access token (no 'Bearer ' prefix needed here)."
    });
    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("Bearer", document)] = []
    });
});

var app = builder.Build();

app.MapDefaultEndpoints();

// Production: apply pending migrations at startup (Database:MigrateOnStartup).
if (app.Configuration.GetValue("Database:MigrateOnStartup", false))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.MigrateAsync();
}

// Production health check for the container (Development maps its own, with
// details, in ServiceDefaults). Not routed by the public proxy (only /api is).
if (!app.Environment.IsDevelopment())
{
    app.MapHealthChecks("/health");
}

// ---- Pipeline ---------------------------------------------------------------

app.UseForwardedHeaders();
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// In Development the API also serves plain HTTP without redirecting, because
// the Android emulator (http://10.0.2.2:58443) can't trust the local dev
// certificate. Everywhere else, HTTP is redirected to HTTPS (spec section 41).
// Behind the production proxy (Hosting:BehindProxy) Caddy does HTTPS and the
// redirect; the API itself serves plain HTTP inside the container network.
if (!app.Environment.IsDevelopment() && !app.Configuration.GetValue("Hosting:BehindProxy", false))
{
    app.UseHttpsRedirection();
}

app.UseCors("ClientApps");

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter(); // after authentication: the AI limit is per user

app.MapControllers();

app.Run();

public partial class Program { }
