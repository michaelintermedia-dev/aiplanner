using System.Diagnostics;
using AiPlanner.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AiPlanner.Infrastructure.Audio;

/// <summary>
/// Re-encodes WAV recordings to AAC in .m4a (mono, 32 kbit/s - plenty for
/// speech, and it plays on web, Android and iOS) with ffmpeg. ffmpeg is looked
/// up at "Recordings:FfmpegPath" or on PATH; without it recordings stay WAV.
/// Already-compressed uploads (the phone's .m4a) are left alone.
/// </summary>
public class FfmpegAudioCompressor : IAudioCompressor
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(60);

    private readonly string _ffmpeg;
    private readonly ILogger<FfmpegAudioCompressor> _logger;
    private bool? _available;

    public FfmpegAudioCompressor(IConfiguration configuration, ILogger<FfmpegAudioCompressor> logger)
    {
        _ffmpeg = configuration["Recordings:FfmpegPath"] is { Length: > 0 } path ? path : "ffmpeg";
        _logger = logger;
    }

    public async Task<(byte[] Audio, string Extension)?> CompressAsync(Stream audio, string extension, CancellationToken ct = default)
    {
        if (!extension.Equals(".wav", StringComparison.OrdinalIgnoreCase) || !await AvailableAsync(ct))
        {
            return null;
        }

        var dir = Path.Combine(Path.GetTempPath(), "aiplanner-audio");
        Directory.CreateDirectory(dir);
        var input = Path.Combine(dir, $"{Guid.NewGuid():N}.wav");
        var output = Path.ChangeExtension(input, ".m4a");
        try
        {
            await using (var file = File.Create(input))
            {
                await audio.CopyToAsync(file, ct);
            }
            var exit = await RunAsync(["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-ac", "1", "-c:a", "aac", "-b:a", "32k", "-movflags", "+faststart", output], ct);
            if (exit != 0 || !File.Exists(output) || new FileInfo(output).Length == 0)
            {
                _logger.LogWarning("Compressing a recording failed (ffmpeg exit {Exit}); keeping it as WAV", exit);
                return null;
            }
            return (await File.ReadAllBytesAsync(output, ct), ".m4a");
        }
        finally
        {
            TryDelete(input);
            TryDelete(output);
        }
    }

    private async Task<bool> AvailableAsync(CancellationToken ct)
    {
        if (_available is { } known) return known;
        try
        {
            _available = await RunAsync(["-hide_banner", "-version"], ct) == 0;
        }
        catch (Exception ex) when (ex is System.ComponentModel.Win32Exception or InvalidOperationException)
        {
            _available = false;
        }
        if (_available == false)
        {
            _logger.LogInformation("ffmpeg not found ({Path}); recordings are kept uncompressed", _ffmpeg);
        }
        return _available.Value;
    }

    private async Task<int> RunAsync(string[] args, CancellationToken ct)
    {
        var start = new ProcessStartInfo(_ffmpeg)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        foreach (var a in args) start.ArgumentList.Add(a);

        using var process = Process.Start(start) ?? throw new InvalidOperationException("ffmpeg did not start.");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(Timeout);
        // Drain the output so ffmpeg never blocks on a full pipe.
        var drain = Task.WhenAll(process.StandardOutput.ReadToEndAsync(timeout.Token), process.StandardError.ReadToEndAsync(timeout.Token));
        try
        {
            await process.WaitForExitAsync(timeout.Token);
            await drain;
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            process.Kill(entireProcessTree: true);
            return -1;
        }
        return process.ExitCode;
    }

    private static void TryDelete(string path)
    {
        try
        {
            if (File.Exists(path)) File.Delete(path);
        }
        catch (IOException)
        {
            // A leftover temp file is harmless.
        }
    }
}
