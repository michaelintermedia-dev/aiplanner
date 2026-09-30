using System.Net.Http.Headers;
using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Auth.Interfaces;
using AiPlanner.Application.Auth.Services;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Infrastructure.Ai;
using AiPlanner.Infrastructure.Identity;
using AiPlanner.Infrastructure.Persistence;
using AiPlanner.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace AiPlanner.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<ApplicationDbContext>());

        services.Configure<JwtSettings>(configuration.GetSection("Jwt"));
        services.Configure<RefreshTokenOptions>(configuration.GetSection("Jwt"));

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddSingleton<IDateTime, DateTimeService>();
        services.AddSingleton<IPasswordHasher, PasswordHasher>();
        services.AddSingleton<ITokenService, TokenService>();

        services.AddScoped<IAuthService, AuthService>();

        services.AddSingleton<IFileStorageService, LocalFileStorageService>();

        // AI provider (spec section 16). Swapping providers means new implementations
        // of these two interfaces - nothing above Infrastructure changes.
        services.Configure<OpenAiOptions>(configuration.GetSection(OpenAiOptions.SectionName));
        // The default resilience handler (from ServiceDefaults) has a 10s attempt
        // timeout and retries; transcription can take longer, and a multipart
        // upload can't be replayed. These clients use one long timeout instead.
        // RemoveAllResilienceHandlers is marked experimental (EXTEXP0001) but is the
        // documented way to opt a single client out of the defaults.
#pragma warning disable EXTEXP0001
        services.AddHttpClient<ITranscriptionService, OpenAiTranscriptionService>(ConfigureOpenAiClient)
            .RemoveAllResilienceHandlers();
        services.AddHttpClient<IIntentExtractionService, OpenAiIntentExtractionService>(ConfigureOpenAiClient)
            .RemoveAllResilienceHandlers();
#pragma warning restore EXTEXP0001

        return services;
    }

    private static void ConfigureOpenAiClient(IServiceProvider sp, HttpClient client)
    {
        var options = sp.GetRequiredService<IOptions<OpenAiOptions>>().Value;
        client.BaseAddress = new Uri(options.BaseUrl.EndsWith('/') ? options.BaseUrl : options.BaseUrl + "/");
        client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
        if (IsConfiguredKey(options.ApiKey))
        {
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", options.ApiKey);
        }
    }

    internal static bool IsConfiguredKey(string? key) =>
        !string.IsNullOrWhiteSpace(key) && !key.StartsWith("REPLACE", StringComparison.OrdinalIgnoreCase);
}
