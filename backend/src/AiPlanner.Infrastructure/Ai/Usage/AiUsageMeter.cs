using System.Threading.Channels;
using AiPlanner.Application.Ai.Usage;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Domain.Entities;
using AiPlanner.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AiPlanner.Infrastructure.Ai.Usage;

/// <summary>Usage rows waiting to be written (bounded: if the database is down, the oldest are dropped rather than memory growing).</summary>
public class AiUsageQueue
{
    private readonly Channel<AiUsage> _channel = Channel.CreateBounded<AiUsage>(
        new BoundedChannelOptions(10_000) { FullMode = BoundedChannelFullMode.DropOldest, SingleReader = true });

    public bool Add(AiUsage row) => _channel.Writer.TryWrite(row);
    public ChannelReader<AiUsage> Reader => _channel.Reader;
}

/// <summary>Per request/job: tells whose call it was and queues the row - the call itself never waits for the database.</summary>
public class AiUsageMeter : IAiUsageMeter
{
    private readonly AiUsageQueue _queue;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTime _clock;
    private readonly ILogger<AiUsageMeter> _logger;

    public AiUsageMeter(AiUsageQueue queue, ICurrentUserService currentUser, IDateTime clock, ILogger<AiUsageMeter> logger)
    {
        _queue = queue;
        _currentUser = currentUser;
        _clock = clock;
        _logger = logger;
    }

    public void Record(AiCall call)
    {
        try
        {
            _queue.Add(new AiUsage
            {
                UserId = AiUsageScope.UserId ?? _currentUser.UserId,
                AtUtc = _clock.UtcNow,
                Kind = call.Kind,
                Model = call.Model.Length > 100 ? call.Model[..100] : call.Model,
                InputTokens = call.InputTokens,
                CachedInputTokens = call.CachedInputTokens,
                AudioInputTokens = call.AudioInputTokens,
                OutputTokens = call.OutputTokens,
                AudioSeconds = call.AudioSeconds,
            });
        }
        catch (Exception ex)
        {
            // Metering must never break the feature it measures.
            _logger.LogWarning(ex, "Could not record AI usage");
        }
    }
}

/// <summary>Writes queued usage rows in small batches (and the rest on shutdown).</summary>
public class AiUsageWriter : BackgroundService
{
    private const int Batch = 200;

    private readonly AiUsageQueue _queue;
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<AiUsageWriter> _logger;

    public AiUsageWriter(AiUsageQueue queue, IServiceScopeFactory scopes, ILogger<AiUsageWriter> logger)
    {
        _queue = queue;
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            while (await _queue.Reader.WaitToReadAsync(stoppingToken))
            {
                await WriteWaitingAsync(CancellationToken.None);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
        await WriteWaitingAsync(CancellationToken.None); // what came in while stopping
    }

    private async Task WriteWaitingAsync(CancellationToken ct)
    {
        while (true)
        {
            var rows = new List<AiUsage>();
            while (rows.Count < Batch && _queue.Reader.TryRead(out var row)) rows.Add(row);
            if (rows.Count == 0) return;
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                db.AiUsages.AddRange(rows);
                await db.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not write {Count} AI usage rows", rows.Count);
                return;
            }
        }
    }
}
