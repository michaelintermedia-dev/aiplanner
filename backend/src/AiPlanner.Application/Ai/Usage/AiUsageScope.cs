namespace AiPlanner.Application.Ai.Usage;

/// <summary>
/// Names the user AI calls are made for where there is no signed-in user - a
/// background job working through several users' files:
/// <c>using (AiUsageScope.For(userId)) { ... }</c>. Flows with async code.
/// </summary>
public static class AiUsageScope
{
    private static readonly AsyncLocal<Guid?> Current = new();

    public static Guid? UserId => Current.Value;

    public static IDisposable For(Guid userId)
    {
        var before = Current.Value;
        Current.Value = userId;
        return new Restore(before);
    }

    private sealed class Restore(Guid? before) : IDisposable
    {
        public void Dispose() => Current.Value = before;
    }
}
