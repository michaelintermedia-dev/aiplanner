using AiPlanner.Application.Common.Interfaces;

namespace AiPlanner.Infrastructure.Jobs;

/// <summary>One pending wake-up at most (several uploads in a row wake the worker once). Singleton.</summary>
public sealed class AttachmentDescriptionSignal : IAttachmentDescriptionSignal
{
    private readonly SemaphoreSlim _signal = new(0, 1);

    public void Wake()
    {
        try
        {
            _signal.Release();
        }
        catch (SemaphoreFullException)
        {
            // Already woken.
        }
    }

    /// <summary>Waits until woken or the timeout passes.</summary>
    public Task WaitAsync(TimeSpan timeout, CancellationToken ct) => _signal.WaitAsync(timeout, ct);
}
