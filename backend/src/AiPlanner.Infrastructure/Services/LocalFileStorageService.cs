using AiPlanner.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace AiPlanner.Infrastructure.Services;

/// <summary>
/// Development/single-server file storage on local disk, under
/// FileStorage:LocalBasePath (relative to the app's content root).
/// </summary>
public class LocalFileStorageService : IFileStorageService
{
    private readonly string _basePath;

    public LocalFileStorageService(IConfiguration configuration, IHostEnvironment environment)
    {
        var configured = configuration["FileStorage:LocalBasePath"] ?? "App_Data/files";
        _basePath = Path.GetFullPath(Path.Combine(environment.ContentRootPath, configured));
    }

    public async Task SaveAsync(string key, Stream content, CancellationToken ct = default)
    {
        var path = Resolve(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var file = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true);
        await content.CopyToAsync(file, ct);
    }

    public Task<Stream?> OpenReadAsync(string key, CancellationToken ct = default)
    {
        var path = Resolve(key);
        Stream? stream = File.Exists(path)
            ? new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true)
            : null;
        return Task.FromResult(stream);
    }

    public Task DeleteAsync(string key, CancellationToken ct = default)
    {
        var path = Resolve(key);
        if (File.Exists(path))
        {
            File.Delete(path);
        }
        return Task.CompletedTask;
    }

    /// <summary>Maps a key to a file path, refusing keys that would escape the storage folder.</summary>
    private string Resolve(string key)
    {
        var path = Path.GetFullPath(Path.Combine(_basePath, key));
        if (!path.StartsWith(_basePath + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("Invalid storage key.", nameof(key));
        }
        return path;
    }
}
