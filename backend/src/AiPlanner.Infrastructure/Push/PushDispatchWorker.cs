using System.Text.Json;
using AiPlanner.Application.Common;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Notifications.DTOs;
using AiPlanner.Application.Notifications.Interfaces;
using AiPlanner.Application.Notifications.Push;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AiPlanner.Infrastructure.Push;

/// <summary>
/// Sends reminders to browsers with web push on (2026-10-18), so they arrive with
/// the tab closed. Every 20 seconds, for each user with a subscription, it asks the
/// same notification rules the apps use what's due next, and sends each one at its
/// moment. Keys already sent are remembered for a day (in memory: a restart can at
/// most repeat one that was due right then).
/// </summary>
public class PushDispatchWorker : BackgroundService
{
    private static readonly TimeSpan Tick = TimeSpan.FromSeconds(20);
    private readonly IServiceScopeFactory _scopes;
    private readonly IWebPushSender _sender;
    private readonly ILogger<PushDispatchWorker> _logger;
    private readonly Dictionary<string, DateTime> _sent = [];

    public PushDispatchWorker(IServiceScopeFactory scopes, IWebPushSender sender, ILogger<PushDispatchWorker> logger)
    {
        _scopes = scopes;
        _sender = sender;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_sender.Enabled) return;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunAsync(stoppingToken);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                _logger.LogError(e, "Web push round failed");
            }
            await Task.Delay(Tick, stoppingToken);
        }
    }

    private async Task RunAsync(CancellationToken ct)
    {
        List<Guid> users;
        using (var scope = _scopes.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
            users = await db.PushSubscriptions.Select(s => s.UserId).Distinct().ToListAsync(ct);
        }

        var now = DateTime.UtcNow;
        foreach (var userId in users)
        {
            List<UpcomingNotificationDto> due;
            using (UserScope.For(userId))
            using (var scope = _scopes.CreateScope())
            {
                due = (await scope.ServiceProvider.GetRequiredService<INotificationService>().GetUpcomingAsync(1, ct))
                    .Where(n => n.AtUtc <= now + Tick).ToList();
            }
            foreach (var n in due)
            {
                if (!_sent.TryAdd($"{userId:N}|{n.Key}", n.AtUtc)) continue;
                _ = SendAtAsync(userId, n, ct);
            }
        }
        foreach (var old in _sent.Where(x => x.Value < now.AddDays(-1)).Select(x => x.Key).ToList()) _sent.Remove(old);
    }

    private async Task SendAtAsync(Guid userId, UpcomingNotificationDto n, CancellationToken ct)
    {
        try
        {
            var wait = n.AtUtc - DateTime.UtcNow;
            if (wait > TimeSpan.Zero) await Task.Delay(wait, ct);
            var payload = JsonSerializer.Serialize(new { title = n.Title, body = n.Body, tag = n.Key, url = PathOf(n) });
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
            var subscriptions = await db.PushSubscriptions.Where(s => s.UserId == userId).ToListAsync(ct);
            foreach (var s in subscriptions)
            {
                if (await _sender.SendAsync(s, payload, ct) == PushResult.Gone) db.PushSubscriptions.Remove(s);
            }
            await db.SaveChangesAsync(ct);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            _logger.LogWarning("Web push send failed: {Error}", e.Message);
        }
    }

    /// <summary>The page a tap on the notification opens.</summary>
    private static string PathOf(UpcomingNotificationDto n) => (n.ItemType, n.ItemId) switch
    {
        ("Task", { } id) => $"/tasks/{id}",
        ("Appointment", { } id) => $"/appointments/{id}",
        ("Note", { } id) => $"/notes/{id}",
        _ => "/today",
    };
}
