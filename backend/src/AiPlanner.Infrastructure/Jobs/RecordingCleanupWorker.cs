using AiPlanner.Application.Captures.Services;
using AiPlanner.Application.Items.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AiPlanner.Infrastructure.Jobs;

/// <summary>
/// Runs <see cref="RecordingCleanup"/> and <see cref="DeletedItemPurge"/> a minute after
/// start, then every six hours. "Recordings:CleanupDryRun" = true only logs what the
/// recording cleanup would delete, and skips the purge.
/// </summary>
public class RecordingCleanupWorker : BackgroundService
{
    private static readonly TimeSpan FirstRun = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan Every = TimeSpan.FromHours(6);

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<RecordingCleanupWorker> _logger;
    private readonly bool _dryRun;
    private readonly Guid? _purgeOnlyUser;

    public RecordingCleanupWorker(IServiceScopeFactory scopes, ILogger<RecordingCleanupWorker> logger, IConfiguration configuration)
    {
        _scopes = scopes;
        _logger = logger;
        _dryRun = configuration.GetValue("Recordings:CleanupDryRun", false);
        // QA: purge just the test account even in a dry run (the dev database has others' data).
        _purgeOnlyUser = Guid.TryParse(configuration["Purge:OnlyUserId"], out var qa) ? qa : null;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(FirstRun, stoppingToken);
            using var timer = new PeriodicTimer(Every);
            do
            {
                try
                {
                    using var scope = _scopes.CreateScope();
                    await scope.ServiceProvider.GetRequiredService<RecordingCleanup>().RunAsync(_dryRun, stoppingToken);
                    if (!_dryRun) await scope.ServiceProvider.GetRequiredService<DeletedItemPurge>().RunAsync(stoppingToken);
                    else if (_purgeOnlyUser is { } qa) await scope.ServiceProvider.GetRequiredService<DeletedItemPurge>().RunAsync(stoppingToken, qa);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    // Try again next time; a failed run never takes the app down.
                    _logger.LogWarning(ex, "Recording cleanup failed");
                }
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException)
        {
            // Shutting down.
        }
    }
}
