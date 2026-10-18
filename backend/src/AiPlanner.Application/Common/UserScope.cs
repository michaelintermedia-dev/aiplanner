namespace AiPlanner.Application.Common;

/// <summary>
/// Lets a background job act for one user (2026-10-18): inside
/// <c>using (UserScope.For(id))</c> ICurrentUserService answers that user, so the
/// normal services (e.g. the notification rules) work outside a web request.
/// </summary>
public static class UserScope
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
