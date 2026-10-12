using AiPlanner.Application.Ai.Usage;
using AiPlanner.Domain.Entities;
using AiPlanner.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace AiPlanner.Application.Tests;

public class AiPricingTests
{
    private static readonly Dictionary<string, ModelPrice> Prices = new(StringComparer.OrdinalIgnoreCase)
    {
        ["chat-mini"] = new ModelPrice { InputPerMillion = 1m, CachedInputPerMillion = 0.1m, OutputPerMillion = 4m },
        ["transcribe"] = new ModelPrice { InputPerMillion = 2m, AudioInputPerMillion = 3m, OutputPerMillion = 5m, PerAudioMinute = 0.006m },
    };

    private static AiUsage Row(string model, int input = 0, int cached = 0, int audio = 0, int output = 0, double? seconds = null, AiUsageKind kind = AiUsageKind.Extraction) =>
        new() { Model = model, Kind = kind, InputTokens = input, CachedInputTokens = cached, AudioInputTokens = audio, OutputTokens = output, AudioSeconds = seconds };

    [Fact]
    public void Text_input_and_output_are_priced_per_million()
    {
        AiPricing.Cost(Row("chat-mini", input: 1_000_000, output: 500_000), Prices).Should().Be(1m + 2m);
    }

    [Fact]
    public void Cached_input_is_charged_at_the_cached_price_and_not_twice()
    {
        // 1M input of which 400k cached: 600k * $1 + 400k * $0.1
        AiPricing.Cost(Row("chat-mini", input: 1_000_000, cached: 400_000), Prices).Should().Be(0.6m + 0.04m);
    }

    [Fact]
    public void Audio_input_is_charged_at_the_audio_price()
    {
        // 1M input of which 750k audio: 250k * $2 + 750k * $3, plus 100k output * $5
        AiPricing.Cost(Row("transcribe", input: 1_000_000, audio: 750_000, output: 100_000), Prices).Should().Be(0.5m + 2.25m + 0.5m);
    }

    [Fact]
    public void Audio_billed_by_duration_uses_the_per_minute_price()
    {
        AiPricing.Cost(Row("transcribe", seconds: 90), Prices).Should().Be(0.009m);
    }

    [Fact]
    public void A_dated_model_name_uses_its_base_models_price()
    {
        AiPricing.PriceFor("chat-mini-2026-03-01", Prices).Should().BeSameAs(Prices["chat-mini"]);
        AiPricing.PriceFor("CHAT-MINI", Prices).Should().BeSameAs(Prices["chat-mini"]);
    }

    [Fact]
    public void A_model_without_a_price_has_no_cost_and_is_reported()
    {
        var unknown = Row("someone-else", input: 1000);
        AiPricing.Cost(unknown, Prices).Should().BeNull();
        AiUsageSummary.Unpriced([unknown, Row("chat-mini")], Prices).Should().Equal("someone-else");
        // "chat-minimal" is not a dated "chat-mini"
        AiPricing.PriceFor("chat-minimal", Prices).Should().BeNull();
    }

    [Fact]
    public void Totals_count_messages_transcriptions_and_descriptions_separately()
    {
        var rows = new[]
        {
            Row("chat-mini", input: 1_000_000, kind: AiUsageKind.Extraction),
            Row("chat-mini", input: 1_000_000, kind: AiUsageKind.Extraction),
            Row("transcribe", seconds: 60, kind: AiUsageKind.Transcription),
            Row("chat-mini", output: 250_000, kind: AiUsageKind.MediaDescription),
        };
        var t = AiUsageSummary.Totals(rows, Prices);
        t.Calls.Should().Be(4);
        t.Messages.Should().Be(2);
        t.Transcriptions.Should().Be(1);
        t.MediaDescriptions.Should().Be(1);
        t.InputTokens.Should().Be(2_000_000);
        t.CostUsd.Should().Be(2m + 0.006m + 1m);
    }
}
