using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using AiPlanner.Application.Ai.Interfaces;
using AiPlanner.Application.Common.Exceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AiPlanner.Infrastructure.Ai;

/// <summary>
/// Extraction via OpenAI Chat Completions with a strict JSON schema, so the
/// reply always has the expected shape. The model only resolves relative dates
/// to wall-clock values; timezone conversion and validation happen in
/// ExtractionNormalizer.
/// </summary>
public class OpenAiIntentExtractionService : IIntentExtractionService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _http;
    private readonly OpenAiOptions _options;
    private readonly ILogger<OpenAiIntentExtractionService> _logger;

    public OpenAiIntentExtractionService(HttpClient http, IOptions<OpenAiOptions> options, ILogger<OpenAiIntentExtractionService> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<RawExtraction> ExtractAsync(ExtractionContext context, CancellationToken ct = default)
    {
        var body = new JsonObject
        {
            ["model"] = _options.Model,
            ["messages"] = new JsonArray
            {
                new JsonObject { ["role"] = "system", ["content"] = BuildInstructions(context) },
                new JsonObject { ["role"] = "user", ["content"] = context.Text },
            },
            ["response_format"] = new JsonObject
            {
                ["type"] = "json_schema",
                ["json_schema"] = new JsonObject
                {
                    ["name"] = "planner_capture",
                    ["strict"] = true,
                    ["schema"] = Schema(),
                },
            },
        };
        if (!string.IsNullOrWhiteSpace(_options.ReasoningEffort))
        {
            body["reasoning_effort"] = _options.ReasoningEffort;
        }

        var request = new HttpRequestMessage(HttpMethod.Post, "chat/completions") { Content = JsonContent.Create(body) };
        using var response = await OpenAiHttp.SendAsync(_http, request, _logger, ct);
        var completion = await response.Content.ReadFromJsonAsync<ChatCompletion>(JsonOptions, ct)
            ?? throw new AiProviderException("Empty response from the AI provider.");

        var choice = completion.Choices?.FirstOrDefault();
        if (choice?.Message?.Refusal is { Length: > 0 })
        {
            throw new AiProviderException("The AI provider declined to process this input.");
        }
        var content = choice?.Message?.Content;
        if (string.IsNullOrWhiteSpace(content) || choice!.FinishReason == "length")
        {
            throw new AiProviderException("The AI provider returned an incomplete answer.");
        }

        CaptureJson parsed;
        try
        {
            parsed = JsonSerializer.Deserialize<CaptureJson>(content, JsonOptions)
                ?? throw new AiProviderException("The AI provider returned an empty answer.");
        }
        catch (JsonException ex)
        {
            throw new AiProviderException("The AI provider returned malformed JSON.", ex);
        }

        var items = (parsed.Items ?? []).Select(i => new RawExtractedItem(
            i.Intent, i.Title, i.Summary, i.Description, i.Date, i.Time, i.EndTime, i.Location,
            i.Priority,
            i.Reminders?.Select(r => new RawReminder(r.Kind, r.MinutesBefore, r.Date, r.Time, r.Days)).ToList(),
            i.Recurrence, i.Clarification, i.Confidence, i.AddsToCurrent ?? false, i.SourceText)).ToList();

        return new RawExtraction(parsed.Title, parsed.Summary, items, content, "OpenAI", completion.Model ?? _options.Model);
    }

    internal static string BuildInstructions(ExtractionContext c)
    {
        var now = c.LocalNow.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);
        var weekday = c.LocalNow.DayOfWeek;
        return $$"""
            You are the parsing engine of a personal planning app. Turn what the user typed or said into planner items.

            Current local date and time: {{now}} ({{weekday}}). Time zone: {{c.TimeZoneId}}. Locale: {{c.Locale}}.

            Item types (intent):
            - "appointment": an event at a specific time, usually with someone or somewhere (meeting, dentist, call scheduled with a person at a time).
            - "task": something the user has to do, optionally with a deadline ("finish the report by Friday").
            - "note": information to keep, with nothing to do and no time of its own.
            There is no separate "reminder" type: a reminder belongs to an item (see "reminders" below). "Remind me to call John at 2pm" is a task due at 14:00 with a reminder of kind "before", minutesBefore 0.

            Dates and times:
            - Resolve relative expressions against the current local date/time above. Output "date" as yyyy-MM-dd and "time"/"endTime" as 24-hour HH:mm, in the user's local time. Never convert time zones.
            - "morning" = 09:00, "afternoon" = 14:00, "evening" = 18:00, "tonight" = 20:00, "noon" = 12:00.
            - A weekday name ("on Monday", "next Monday", "this Friday") means the first such day after today; if that is ambiguous, pick it and say so in "clarification".
            - "end of the week" = this week's Friday; "next week" without a day = next Monday; "next month" = the 1st of next month.
            - "in two hours" / "in three days" are relative to now.
            - For a task, "date"/"time" are the deadline. For an appointment, they are the start; "endTime" only if an end or duration is given, otherwise null. A note has no date or time of its own.
            - Leave "date"/"time" null when none is given. Do not guess times.

            Other fields:
            - "title": short and action-oriented (at most ~6 words), e.g. "Prepare proposal", "Meet Sarah". Write every title, summary and clarification in the same language the user used.
            - "priority": "high", "medium" or "low" only if stated or clearly implied (urgent, ASAP, important); otherwise null.
            - "reminders": [] unless the user asks to be reminded. One object per reminder ("remind me at 3 and at 4" = two), each with "kind":
              - "before": relative to the item's own time; "minutesBefore" = 0 for "at the time", 30 for "30 minutes before".
              - "at": once, at a moment not tied to the item ("remind me in an hour", "remind me about this tomorrow morning"); put it in the reminder's "date"/"time".
              - "daily" / "weekdays": repeats every day / Monday-Friday at the reminder's "time" ("every day at 8" = daily, 08:00).
              - "weekly": repeats on "days" (English weekday names, e.g. ["Monday","Thursday"]) at "time".
              Unused reminder fields are null.
            - "recurrence": "daily", "weekdays", "weekly" or "monthly" only if the user says it repeats; otherwise null.
            - "location": only if a place is mentioned.
            - "clarification": a short question for the user when something important is missing or ambiguous (e.g. an appointment with no time); otherwise null.
            - "confidence": 0 to 1, how sure you are that the item is right.
            - "sourceText": the exact words from the input this item came from, copied verbatim (same language, same wording, no paraphrase) - the whole stretch that talks about it. Used to play just that part of a voice recording.
            - Top-level "title": 2-5 words naming the whole capture. Top-level "summary": 1-2 sentences if the input is longer than one sentence, otherwise null.

            Only extract what the user actually said. Never invent items, people, places or times.
            - "addsToCurrent": false, unless the "Continuing" section below says otherwise.

            Never return nothing: if the input is a question, an idea, or anything that isn't clearly a task or appointment, return it as a single "note" whose "description" keeps the user's words. The user can change any item's type in the review.
            """ + Continuing(c);
    }

    /// <summary>Extra instructions when the user adds to an earlier capture ("continue talking").</summary>
    private static string Continuing(ExtractionContext c)
    {
        if (c.CurrentItem is not null)
        {
            // Adding to one saved item: strictly that item - nothing else from the
            // original message is shown, and nothing else may come back.
            var earlier = string.IsNullOrWhiteSpace(c.PreviousText) ? "" : $"""

                What they said about this item before (context only):
                «{c.PreviousText}»
                """;
            return $"""


                UPDATING ONE ITEM. The user opened this saved item and is adding to it (dates and times are local):
                {c.CurrentItem}{earlier}

                Work only on this item. Return exactly ONE item, with "addsToCurrent": true, that is the WHOLE item after the change:
                - "intent" and "title": exactly as in the saved item.
                - "description": the saved description followed by the new detail in the user's own words (keep everything that was there). Anything in the new input that isn't a field change goes here - never into a separate item.
                - "date", "time", "endTime", "location", "priority": the saved values, unless the new input changes them.
                - "reminders": the saved reminders plus any new ones; remove or change one only if the user says so.
                - "sourceText": the new words.
                """;
        }
        if (c.PreviousText is null)
        {
            return "";
        }
        return $"""


            Continuing: the user is adding to something they said earlier. Earlier they said (already handled - do not extract it again):
            «{c.PreviousText}»
            Use it only as context; extract items from the new input only.
            """;
    }

    private static JsonObject ReminderSchema() => new()
    {
        ["type"] = "object",
        ["additionalProperties"] = false,
        ["required"] = new JsonArray("kind", "minutesBefore", "date", "time", "days"),
        ["properties"] = new JsonObject
        {
            ["kind"] = new JsonObject { ["type"] = "string", ["enum"] = new JsonArray("before", "at", "daily", "weekdays", "weekly") },
            ["minutesBefore"] = new JsonObject { ["type"] = new JsonArray("integer", "null") },
            ["date"] = new JsonObject { ["type"] = new JsonArray("string", "null"), ["description"] = "yyyy-MM-dd, local" },
            ["time"] = new JsonObject { ["type"] = new JsonArray("string", "null"), ["description"] = "HH:mm 24h, local" },
            ["days"] = new JsonObject
            {
                ["type"] = new JsonArray("array", "null"),
                ["items"] = new JsonObject
                {
                    ["type"] = "string",
                    ["enum"] = new JsonArray("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"),
                },
            },
        },
    };

    private static JsonObject Schema()
    {
        static JsonObject Nullable(string type, string? description = null, JsonArray? values = null)
        {
            var o = new JsonObject { ["type"] = new JsonArray(type, "null") };
            if (description is not null) o["description"] = description;
            if (values is not null) o["enum"] = values;
            return o;
        }

        var item = new JsonObject
        {
            ["type"] = "object",
            ["additionalProperties"] = false,
            ["required"] = new JsonArray("intent", "title", "summary", "description", "date", "time", "endTime",
                "location", "priority", "reminders", "recurrence", "clarification", "confidence", "addsToCurrent", "sourceText"),
            ["properties"] = new JsonObject
            {
                ["intent"] = new JsonObject { ["type"] = "string", ["enum"] = new JsonArray("task", "appointment", "note") },
                ["title"] = new JsonObject { ["type"] = "string" },
                ["summary"] = Nullable("string"),
                ["description"] = Nullable("string", "Extra detail from the input worth keeping"),
                ["date"] = Nullable("string", "yyyy-MM-dd, local"),
                ["time"] = Nullable("string", "HH:mm 24h, local"),
                ["endTime"] = Nullable("string", "HH:mm 24h, local"),
                ["location"] = Nullable("string"),
                ["priority"] = Nullable("string", values: new JsonArray("low", "medium", "high", null)),
                ["reminders"] = new JsonObject { ["type"] = "array", ["items"] = ReminderSchema() },
                ["recurrence"] = Nullable("string", values: new JsonArray("daily", "weekdays", "weekly", "monthly", null)),
                ["clarification"] = Nullable("string"),
                ["confidence"] = new JsonObject { ["type"] = "number" },
                ["addsToCurrent"] = new JsonObject { ["type"] = "boolean" },
                ["sourceText"] = new JsonObject { ["type"] = "string", ["description"] = "Verbatim excerpt of the input this item came from" },
            },
        };

        return new JsonObject
        {
            ["type"] = "object",
            ["additionalProperties"] = false,
            ["required"] = new JsonArray("title", "summary", "items"),
            ["properties"] = new JsonObject
            {
                ["title"] = new JsonObject { ["type"] = "string" },
                ["summary"] = Nullable("string"),
                ["items"] = new JsonObject { ["type"] = "array", ["items"] = item },
            },
        };
    }

    // ---- Wire formats ------------------------------------------------------

    private sealed record ChatCompletion(string? Model, List<Choice>? Choices);

    private sealed record Choice(Message? Message, [property: JsonPropertyName("finish_reason")] string? FinishReason);

    private sealed record Message(string? Content, string? Refusal);

    private sealed record CaptureJson(string? Title, string? Summary, List<ItemJson>? Items);

    private sealed record ItemJson(
        string? Intent, string? Title, string? Summary, string? Description,
        string? Date, string? Time, string? EndTime, string? Location, string? Priority,
        List<ReminderJson>? Reminders, string? Recurrence, string? Clarification, double? Confidence, bool? AddsToCurrent, string? SourceText);

    private sealed record ReminderJson(string? Kind, int? MinutesBefore, string? Date, string? Time, List<string>? Days);
}
