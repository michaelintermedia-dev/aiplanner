using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Notifications.Push;

/// <summary>This browser's web push on or off, for the signed-in user.</summary>
public class PushSubscriptionService
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTime _clock;

    public PushSubscriptionService(IApplicationDbContext db, ICurrentUserService currentUser, IDateTime clock)
    {
        _db = db;
        _currentUser = currentUser;
        _clock = clock;
    }

    private Guid UserId => _currentUser.UserId ?? throw new UnauthorizedAccessException("No authenticated user.");

    /// <summary>Adds the browser, or moves it to this user (another account signed in on it before).</summary>
    public async Task SubscribeAsync(PushSubscribeRequest request, CancellationToken ct = default)
    {
        var existing = await _db.PushSubscriptions.FirstOrDefaultAsync(s => s.Endpoint == request.Endpoint, ct);
        if (existing is null)
        {
            _db.PushSubscriptions.Add(new PushSubscription
            {
                UserId = UserId, Endpoint = request.Endpoint, P256dh = request.P256dh, Auth = request.Auth, CreatedAtUtc = _clock.UtcNow,
            });
        }
        else
        {
            existing.UserId = UserId;
            existing.P256dh = request.P256dh;
            existing.Auth = request.Auth;
        }
        await _db.SaveChangesAsync(ct);
    }

    public async Task UnsubscribeAsync(string endpoint, CancellationToken ct = default) =>
        await _db.PushSubscriptions.Where(s => s.UserId == UserId && s.Endpoint == endpoint).ExecuteDeleteAsync(ct);
}
