using AiPlanner.Application.Captures.Services;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class RecordingCleanupTests
{
    private static readonly DateTime Now = new(2026, 10, 3, 12, 0, 0, DateTimeKind.Utc);

    [Theory]
    [InlineData(1, 0, 48, false)] // an item still uses it
    [InlineData(0, 1, 48, false)] // still waiting for Save / Cancel
    [InlineData(0, 0, 2, false)] // all deleted, but only 2 hours ago - Undo / change of mind
    [InlineData(0, 0, 24, true)] // all deleted a day ago
    [InlineData(0, 0, 200, true)] // nothing was ever saved (review cancelled), long ago
    public void A_recording_goes_only_when_nothing_uses_it_for_a_day(int live, int pending, int hoursSinceTouched, bool expected) =>
        RecordingCleanup.IsOrphan(live, pending, Now.AddHours(-hoursSinceTouched), Now).Should().Be(expected);
}
