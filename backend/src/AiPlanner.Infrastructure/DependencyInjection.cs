using AiPlanner.Application.Notifications.Push;
using AiPlanner.Infrastructure.Push;
using Microsoft.Extensions.Logging;
using AiPlanner.Infrastructure.Audio;
using AiPlanner.Infrastructure.Jobs;
using System.Net.Http.Headers;
using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Auth.Interfaces;
using AiPlanner.Application.Auth.Services;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Ai.Usage;
using AiPlanner.Infrastructure.Ai;
using AiPlanner.Infrastructure.Email;
using AiPlanner.Infrastructure.Ai.Usage;
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
        services.AddSingleton<IRegistrationPolicy, ConfigRegistrationPolicy>();
        services.AddSingleton<IAdminPolicy, ConfigAdminPolicy>();
        // The app's emails (codes): Resend when Email:ApiKey + From are set, else off (or the log in Development).
        services.Configure<EmailOptions>(configuration.GetSection(EmailOptions.SectionName));
        if (!string.IsNullOrWhiteSpace(configuration["Email:ApiKey"]) && !string.IsNullOrWhiteSpace(configuration["Email:From"]))
        {
            services.AddHttpClient<IEmailSender, ResendEmailSender>(c => c.Timeout = TimeSpan.FromSeconds(15));
        }
        else
        {
            services.AddSingleton<IEmailSender, LogEmailSender>();
        }
        // Sign in with Google / Apple: their ID tokens are checked here.
        services.Configure<ExternalAuthOptions>(configuration.GetSection(ExternalAuthOptions.SectionName));
        services.AddSingleton<IExternalTokenValidator, OidcExternalTokenValidator>();

        services.AddScoped<IAuthService, AuthService>();

        services.AddSingleton<IFileStorageService, LocalFileStorageService>();
        // Deletes recordings no item uses any more (see RecordingCleanup).
        services.AddHostedService<RecordingCleanupWorker>();
        // Describes photos/documents for search (see AttachmentDescriber).
        services.AddSingleton<AttachmentDescriptionSignal>();
        services.AddSingleton<IAttachmentDescriptionSignal>(sp => sp.GetRequiredService<AttachmentDescriptionSignal>());
        services.AddHostedService<AttachmentDescriptionWorker>();
        // Web push: reminders in the browser with the tab closed (off without VAPID keys).
        services.AddHttpClient("webpush", c => c.Timeout = TimeSpan.FromSeconds(15));
        services.AddSingleton<IWebPushSender>(sp => new WebPushSender(
            sp.GetRequiredService<IHttpClientFactory>().CreateClient("webpush"), configuration, sp.GetRequiredService<ILogger<WebPushSender>>()));
        services.AddHostedService<PushDispatchWorker>();
        // Stored recordings: WAV -> AAC when ffmpeg is available.
        services.AddSingleton<IAudioCompressor, FfmpegAudioCompressor>();

        // AI provider (spec section 16). Swapping providers means new implementations
        // of these two interfaces - nothing above Infrastructure changes.
        services.Configure<OpenAiOptions>(configuration.GetSection(OpenAiOptions.SectionName));
        // What each AI call used, per user (AiUsage rows, written in the background).
        services.Configure<AiPricingOptions>(configuration.GetSection(AiPricingOptions.SectionName));
        services.AddSingleton<AiUsageQueue>();
        services.AddScoped<IAiUsageMeter, AiUsageMeter>();
        services.AddHostedService<AiUsageWriter>();
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
        services.AddHttpClient<IMediaDescriptionService, OpenAiMediaDescriptionService>(ConfigureOpenAiClient)
            .RemoveAllResilienceHandlers();
        // What shared links are (page titles) - public addresses only, see HttpLinkPreviewService.Handler.
        services.AddHttpClient<ILinkPreviewService, HttpLinkPreviewService>(client =>
            {
                client.Timeout = TimeSpan.FromSeconds(6);
                client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (compatible; GatazeeBot/1.0; +https://gatazee.com)");
                client.DefaultRequestHeaders.AcceptLanguage.ParseAdd("en;q=0.8,*;q=0.5");
            })
            .ConfigurePrimaryHttpMessageHandler(HttpLinkPreviewService.Handler)
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
