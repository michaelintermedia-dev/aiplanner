using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace AiPlanner.Infrastructure.Persistence;

/// <summary>
/// Stores DateTimes as UTC and marks them as <see cref="DateTimeKind.Utc"/> when
/// read back. Registered for all DateTime properties in
/// <see cref="ApplicationDbContext.ConfigureConventions"/>.
/// </summary>
public class UtcDateTimeConverter : ValueConverter<DateTime, DateTime>
{
    public UtcDateTimeConverter()
        : base(
            v => v.Kind == DateTimeKind.Local ? v.ToUniversalTime() : v,
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc))
    {
    }
}
