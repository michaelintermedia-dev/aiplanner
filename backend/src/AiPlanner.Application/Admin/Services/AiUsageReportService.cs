using AiPlanner.Application.Admin.DTOs;
using AiPlanner.Application.Ai.Usage;
using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Application.Common.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AiPlanner.Application.Admin.Services;

/// <summary>The operator's AI cost report (admins only - IAdminPolicy).</summary>
public class AiUsageReportService
{
    public const string NotAllowed = "Not allowed.";

    private readonly IApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IAdminPolicy _admins;
    private readonly IDateTime _clock;
    private readonly AiPricingOptions _pricing;

    public AiUsageReportService(IApplicationDbContext db, ICurrentUserService currentUser, IAdminPolicy admins, IDateTime clock, IOptions<AiPricingOptions> pricing)
    {
        _db = db;
        _currentUser = currentUser;
        _admins = admins;
        _clock = clock;
        _pricing = pricing.Value;
    }

    public async Task<Result<AiUsageReportDto>> ReportAsync(int days, CancellationToken ct = default)
    {
        if (_currentUser.UserId is not { } me) return Result<AiUsageReportDto>.Failure(NotAllowed);
        var email = await _db.Users.Where(u => u.Id == me).Select(u => u.Email).FirstOrDefaultAsync(ct);
        if (email is null || !_admins.IsAdmin(email)) return Result<AiUsageReportDto>.Failure(NotAllowed);

        days = Math.Clamp(days, 1, 366);
        var to = _clock.UtcNow;
        var from = to.Date.AddDays(1 - days);

        var rows = await _db.AiUsages.AsNoTracking().Where(u => u.AtUtc >= from && u.AtUtc <= to).ToListAsync(ct);
        var prices = _pricing.Models;
        var userIds = rows.Where(r => r.UserId is not null).Select(r => r.UserId!.Value).Distinct().ToList();
        var people = await _db.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Email, u.DisplayName })
            .ToDictionaryAsync(u => u.Id, ct);

        var users = rows
            .GroupBy(r => r.UserId)
            .Select(g =>
            {
                var list = g.ToList();
                var totals = AiUsageSummary.Totals(list, prices);
                var who = g.Key is { } id && people.TryGetValue(id, out var p) ? p : null;
                return new AiUsageUserDto(
                    g.Key, who?.Email, who?.DisplayName, totals,
                    ActiveDays: list.Select(r => r.AtUtc.Date).Distinct().Count(),
                    CostPerMessageUsd: totals.Messages > 0 ? Math.Round(totals.CostUsd / totals.Messages, 5) : null);
            })
            .OrderByDescending(u => u.Totals.CostUsd)
            .ToList();

        var perDay = rows
            .GroupBy(r => r.AtUtc.Date)
            .OrderBy(g => g.Key)
            .Select(g =>
            {
                var t = AiUsageSummary.Totals(g.ToList(), prices);
                return new AiUsageDayDto(g.Key.ToString("yyyy-MM-dd"), t.Calls, t.Messages, t.CostUsd);
            })
            .ToList();

        return Result<AiUsageReportDto>.Success(new AiUsageReportDto(
            from, to, days, AiUsageSummary.Totals(rows, prices), users, perDay, AiUsageSummary.Unpriced(rows, prices)));
    }
}
