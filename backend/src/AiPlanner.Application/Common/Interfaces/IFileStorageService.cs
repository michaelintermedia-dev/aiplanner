namespace AiPlanner.Application.Common.Interfaces;

/// <summary>
/// Stores binary files (voice recordings) outside the database - SQL Server only
/// keeps the returned key (spec section 33). Local disk in development; can be
/// swapped for cloud object storage without touching callers.
/// </summary>
public interface IFileStorageService
{
    /// <summary>Saves the stream under <paramref name="key"/> (a relative path such as "{userId}/{id}.webm").</summary>
    Task SaveAsync(string key, Stream content, CancellationToken ct = default);

    /// <summary>Opens the file for reading, or returns null if it doesn't exist.</summary>
    Task<Stream?> OpenReadAsync(string key, CancellationToken ct = default);

    /// <summary>Deletes the file; does nothing if it doesn't exist.</summary>
    Task DeleteAsync(string key, CancellationToken ct = default);
}
