using AiPlanner.Application.Common.Interfaces;
using AiPlanner.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AiPlanner.Application.Tags;

/// <summary>
/// Tags on any item (task, appointment, note): the user's own list of tags,
/// matched case-insensitively ("shopping" = "Shopping"); a name not used before
/// is added to the list. Null leaves an item's tags as they are; [] clears them.
/// </summary>
public static class TagSync
{
    public const int MaxPerItem = 20;
    public const int MaxLength = 50;

    /// <summary>The names as they'll be kept: trimmed, no empties or duplicates (case-insensitive), at most MaxPerItem.</summary>
    public static List<string> Clean(IEnumerable<string>? names) =>
        (names ?? [])
            .Select(n => n.Trim())
            .Where(n => n.Length > 0)
            .Select(n => n.Length > MaxLength ? n[..MaxLength].TrimEnd() : n)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(MaxPerItem)
            .ToList();

    /// <summary>Sets an item's tags: <paramref name="link"/> makes the join row for a tag.</summary>
    public static async Task ApplyAsync<TJoin>(
        IApplicationDbContext db, Guid userId, ICollection<TJoin> joins, IReadOnlyList<string>? names, Func<Tag, TJoin> link, CancellationToken ct)
    {
        if (names is null) return;
        var wanted = Clean(names);
        joins.Clear();
        if (wanted.Count == 0) return;

        // Tag names are citext: Contains compares case-insensitively in the database.
        var existing = await db.Tags.Where(t => t.UserId == userId && wanted.Contains(t.Name)).ToListAsync(ct);
        foreach (var name in wanted)
        {
            var tag = existing.FirstOrDefault(t => t.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
            if (tag is null)
            {
                tag = new Tag { UserId = userId, Name = name };
                db.Tags.Add(tag);
                existing.Add(tag);
            }
            joins.Add(link(tag));
        }
    }
}
