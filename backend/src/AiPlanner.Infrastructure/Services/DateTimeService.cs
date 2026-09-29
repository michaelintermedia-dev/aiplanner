using AiPlanner.Application.Common.Interfaces;

namespace AiPlanner.Infrastructure.Services;

public class DateTimeService : IDateTime
{
    public DateTime UtcNow => DateTime.UtcNow;
}
