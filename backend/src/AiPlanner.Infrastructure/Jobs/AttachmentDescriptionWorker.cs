using AiPlanner.Application.Attachments.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AiPlanner.Infrastructure.Jobs;

/// <summary>
/// Runs AttachmentDescriber until nothing is waiting - at once when woken
/// (an upload, AttachmentDescriptionSignal), else once a minute.
/// </summary>
public class AttachmentDescriptionWorker : BackgroundService
{
    private static readonly TimeSpan FirstRun = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan Every = TimeSpan.FromMinutes(1);

    private readonly IServiceScopeFactory _scopes;
    private readonly AttachmentDescriptionSignal _signal;
    private readonly ILogger<AttachmentDescriptionWorker> _logger;

    public AttachmentDescriptionWorker(IServiceScopeFactory scopes, AttachmentDescriptionSignal signal, ILogger<AttachmentDescriptionWorker> logger)
    {
        _scopes = scopes;
        _signal = signal;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await _signal.WaitAsync(FirstRun, stoppingToken);
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    // A full batch means more may be waiting: go on at once.
                    int looked;
                    do
                    {
                        using var scope = _scopes.CreateScope();
                        looked = await scope.ServiceProvider.GetRequiredService<AttachmentDescriber>().RunAsync(stoppingToken);
                    }
                    while (looked == AttachmentDescriber.Batch);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    // Try again next time; a failed run never takes the app down.
                    _logger.LogWarning(ex, "Attachment descriptions failed");
                }
                await _signal.WaitAsync(Every, stoppingToken);
            }
        }
        catch (OperationCanceledException)
        {
            // Shutting down.
        }
    }
}
