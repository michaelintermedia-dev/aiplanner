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
                new JsonObject { ["role"] = "user", ["content"] = UserContent(context) },
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
            i.Recurrence, i.Clarification, i.Confidence, i.AddsToCurrent ?? false, i.SourceText, i.Unrelated, i.RecurrenceDays, i.RecurrenceInterval, i.Tags)).ToList();

        var search = parsed.Search is { } s ? new RawSearch(s.Text, s.Tags, s.Kinds, s.When, s.Status, s.Reminders, s.FromVoice) : null;
        return new RawExtraction(parsed.Title, parsed.Summary, items, content, "OpenAI", completion.Model ?? _options.Model, search);
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
            - "recurrence": "daily", "weekdays", "weekly" or "monthly" only if the user says it repeats; otherwise null. The item's own "date"/"time" is the first time it happens ("every Monday at 9" -> the next Monday, 09:00; "pay rent on the 1st of every month" -> the next 1st).
            - "recurrenceDays": for "weekly", the weekdays it falls on as English names (["Monday","Thursday"]); otherwise null.
            - "recurrenceInterval": every N days/weeks/months ("every 2 weeks" = 2); null for 1.
            - "location": only if a place is mentioned.
            - "tags": 1-3 short tags that sort the item by topic, decided from the whole context - the words and any attached photos or documents (a photo of a chair -> "chair", "furniture"; an electricity bill -> "bills", "home"; "dentist on Friday" -> "health"; "buy milk" -> "shopping"). The user's existing tags come first - use one whenever it fits, spelled exactly as it is: {{KnownTags(c)}}. Make a new tag only when none fits: one or two words, lower case (names keep their capitals), in the language of the user's words (with no words, the language of the description). Also every tag the user asks for ("tag it shopping", "put it under work").
            - "clarification": a short question for the user when something important is missing or ambiguous (e.g. an appointment with no time); otherwise null.
            - "confidence": 0 to 1, how sure you are that the item is right.
            - "sourceText": the exact words from the input this item came from, copied verbatim (same language, same wording, no paraphrase) - the whole stretch that talks about it. Used to play just that part of a voice recording.
            - Top-level "title": 2-5 words naming the whole capture. Top-level "summary": 1-2 sentences if the input is longer than one sentence, otherwise null. The summary is read by the person who said it: write it as a short note of what's planned ("Batteries tomorrow; dinner with Sara on Friday at 19:00"), never about "the user" and never in the third person.

            Only extract what the user actually said. Never invent items, people, places or times.
            - "addsToCurrent": false, unless the "Continuing" section below says otherwise.
            - "unrelated": null, unless the "UPDATING ONE ITEM" section below says otherwise.
            - Top-level "search": null, unless the "FIND" section below says otherwise.

            Never return nothing: if the input is a question, an idea, or anything that isn't clearly a task or appointment, return it as a single "note" whose "description" keeps the user's words. The user can change any item's type in the review.
            """ + OneEntry(c) + Continuing(c) + AttachedFiles(c) + Find(c);
    }

    /// <summary>A new capture can be a search instead ("find the photo of the wifi password").</summary>
    private static string Find(ExtractionContext c) => c.CurrentItem is not null ? "" : $$"""


        FIND. If the user asks to find, show, search for or look up entries they ALREADY have ("find my shopping stuff", "show me everything about the dentist", "where's the photo of the wifi password", "what's overdue", "show my notes"), create nothing: return "items": [] and fill "search":
        - "text": the one or two most telling words to look for in the entries and in the descriptions of their attached photos and documents ("wifi", "dentist", "IKEA") - in the language the user spoke. Leave out words like find, show, my, all, items, entries, photo, picture, note, task. null when the request is only about tags, type, dates or status.
        - "tags": tags they name, matched to their existing tags: {{KnownTags(c)}}. [] if none.
        - "kinds": the types they name - "task", "appointment" (event, meeting), "note"; [] for all.
        - "when": "today", "week", "overdue" or "nodate" if they name when it's due / happens; otherwise null.
        - "status": "open" or "done" if they ask for it; otherwise null.
        - "reminders": "with", "repeating" or "without" if they ask for it; otherwise null.
        - "fromVoice": true only for things they recorded / said by voice.
        - Top-level "title": what is looked for ("Find: wifi password").
        Anything else - something to do, to remember, an event - is a new entry as usual, with "search": null. When in doubt, it's a new entry.
        """;

    /// <summary>The user's words, then each attached file: pictures and PDFs as they are, documents as text.</summary>
    private static JsonNode UserContent(ExtractionContext c)
    {
        if (c.Media is not { Count: > 0 } media) return JsonValue.Create(c.Text)!;
        var parts = new JsonArray
        {
            new JsonObject { ["type"] = "text", ["text"] = string.IsNullOrWhiteSpace(c.Text) ? "(No words - only the attached files.)" : c.Text },
        };
        foreach (var m in media)
        {
            if (m.Kind == MediaInputKind.Image) parts.Add(new JsonObject { ["type"] = "text", ["text"] = $"Attached photo «{m.FileName}»:" });
            parts.Add(OpenAiMediaParts.Part(m));
        }
        return parts;
    }

    /// <summary>Photos and documents sent with the words: read them as part of what the user said.</summary>
    private static string AttachedFiles(ExtractionContext c) => c.Media is not { Count: > 0 } ? "" : $$"""


        ATTACHED FILES. The user attached photos or documents (after their words). Read them as part of what the user said:
        - Take what matters from them - dates, times, places, names, amounts, what has to be done: a flyer, invitation or ticket -> an appointment at its date, time and place; a bill or letter with a deadline -> a task due then; a receipt -> a note with the shop, date and total; a screenshot of a message -> what it asks for; a recipe, list or anything to keep -> a note.
        - The user's words decide what to do with them ("remind me to pay this", "add this to my calendar"). With no words, make the item the files are about.
        - "title": what it is, specific ("Jazz concert - Blue Note", "Electricity bill", "IKEA receipt"), never just "Photo" or the file name.
        - "description": the useful facts from the files in a few short lines - never the whole text.
        - Language (user's rule): what comes from a file is written in the language of the text in it - a document, or a picture with writing on it (a flyer, a label, a screenshot). A picture with no text (a plain photo) is described in {{OpenAiMediaParts.AppLanguage(c.Locale)}} (the app's language). Names, addresses, codes and amounts stay as written. The "title" follows the user's words when there are any; with no words, the same language as the description.
        - Never invent what isn't in the files or the words; if a date or time is unreadable, ask in "clarification".
        - "sourceText": the user's words only ("" when there are none).
        """;

    private static string KnownTags(ExtractionContext c) =>
        c.KnownTags is { Count: > 0 } tags ? string.Join(", ", tags.Select(t => $"\"{t}\"")) : "none yet";

    /// <summary>"One entry per message" (Settings): never split what was said into several items.</summary>
    private static string OneEntry(ExtractionContext c) => !c.OneEntry || c.CurrentItem is not null ? "" : """


        ONE ENTRY. This user wants every message saved as exactly ONE item - never two or more, even when several things are mentioned.
        - Pick the type and title for the main thing said (an appointment if a meeting/visit at a time is mentioned, else a task if something must be done, else a note).
        - Its "date"/"time" are the main thing's.
        - Everything else said goes into its "description": the main thing's details first (if any), then one line per other thing, each starting with "• ", in the user's own words with their dates and times. Example: "Dentist on Friday at 10, also buy milk, and the wifi code is 1234" -> an appointment "Dentist" on Friday 10:00 with description "• Buy milk\n• The wifi code is 1234".
        - Every reminder asked for goes into its "reminders".
        - "sourceText": the whole input.
        """;

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
                - "title": exactly as in the saved item.
                - "intent": as in the saved item, unless the user explicitly asks to change what it is ("make it an event", "turn this into a note", "it's actually a meeting", "make it a task") - then the new type. A date, time, place or person alone never changes it.
                - "description": the saved description (keep everything that was there), then the new information about this item in the user's own words, as its own sentence. Information only: leave out instructions you carried out in the fields ("make it an event", "remind me at 5", "move it to 3pm", "make it high priority") - those show as the changed fields. Example: saved description "Leak under the sink", new input "Make it high priority and remind me 30 minutes before. The code for the door is 1234." -> description "Leak under the sink. The code for the door is 1234." (priority and the reminder go into their fields). If the new input is only instructions, the description stays exactly as saved.
                - "unrelated": words from the new input that are not about this item at all (a different errand, e.g. "Also call mom tonight"), copied verbatim; null if everything is about this item. Anything you'd do as a separate errand counts, even with "also" or "on the way": for a "Call plumber back" task, "Also buy milk on the way home" is unrelated, "Ask him about the kitchen tap" is not. Keep them out of the description - the user is offered to capture them separately. Never return them as a second item.
                - "date", "time", "endTime", "location", "priority": the saved values, unless the new input changes them.
                - "reminders": the saved reminders plus any new ones; remove or change one only if the user says so.
                - "tags": the saved tags plus any the user asks to add; remove one only if the user says so.
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
                "location", "priority", "reminders", "recurrence", "recurrenceDays", "recurrenceInterval", "tags", "clarification", "confidence", "addsToCurrent", "sourceText", "unrelated"),
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
                ["recurrenceDays"] = new JsonObject
                {
                    ["type"] = new JsonArray("array", "null"),
                    ["items"] = new JsonObject
                    {
                        ["type"] = "string",
                        ["enum"] = new JsonArray("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"),
                    },
                },
                ["recurrenceInterval"] = new JsonObject { ["type"] = new JsonArray("integer", "null") },
                ["tags"] = new JsonObject { ["type"] = "array", ["items"] = new JsonObject { ["type"] = "string" } },
                ["clarification"] = Nullable("string"),
                ["confidence"] = new JsonObject { ["type"] = "number" },
                ["addsToCurrent"] = new JsonObject { ["type"] = "boolean" },
                ["sourceText"] = new JsonObject { ["type"] = "string", ["description"] = "Verbatim excerpt of the input this item came from" },
                ["unrelated"] = Nullable("string", "Updating one item: verbatim words not about it"),
            },
        };

        return new JsonObject
        {
            ["type"] = "object",
            ["additionalProperties"] = false,
            ["required"] = new JsonArray("title", "summary", "items", "search"),
            ["properties"] = new JsonObject
            {
                ["title"] = new JsonObject { ["type"] = "string" },
                ["summary"] = Nullable("string"),
                ["items"] = new JsonObject { ["type"] = "array", ["items"] = item },
                ["search"] = new JsonObject
                {
                    ["type"] = new JsonArray("object", "null"),
                    ["additionalProperties"] = false,
                    ["required"] = new JsonArray("text", "tags", "kinds", "when", "status", "reminders", "fromVoice"),
                    ["properties"] = new JsonObject
                    {
                        ["text"] = Nullable("string"),
                        ["tags"] = new JsonObject { ["type"] = "array", ["items"] = new JsonObject { ["type"] = "string" } },
                        ["kinds"] = new JsonObject
                        {
                            ["type"] = "array",
                            ["items"] = new JsonObject { ["type"] = "string", ["enum"] = new JsonArray("task", "appointment", "note") },
                        },
                        ["when"] = Nullable("string", values: new JsonArray("today", "week", "overdue", "nodate", null)),
                        ["status"] = Nullable("string", values: new JsonArray("open", "done", null)),
                        ["reminders"] = Nullable("string", values: new JsonArray("with", "repeating", "without", null)),
                        ["fromVoice"] = new JsonObject { ["type"] = "boolean" },
                    },
                },
            },
        };
    }

    // ---- Wire formats ------------------------------------------------------

    private sealed record ChatCompletion(string? Model, List<Choice>? Choices);

    private sealed record Choice(Message? Message, [property: JsonPropertyName("finish_reason")] string? FinishReason);

    private sealed record Message(string? Content, string? Refusal);

    private sealed record CaptureJson(string? Title, string? Summary, List<ItemJson>? Items, SearchJson? Search);

    private sealed record SearchJson(string? Text, List<string>? Tags, List<string>? Kinds, string? When, string? Status, string? Reminders, bool? FromVoice);

    private sealed record ItemJson(
        string? Intent, string? Title, string? Summary, string? Description,
        string? Date, string? Time, string? EndTime, string? Location, string? Priority,
        List<ReminderJson>? Reminders, string? Recurrence, string? Clarification, double? Confidence, bool? AddsToCurrent, string? SourceText, string? Unrelated,
        List<string>? RecurrenceDays, int? RecurrenceInterval, List<string>? Tags);

    private sealed record ReminderJson(string? Kind, int? MinutesBefore, string? Date, string? Time, List<string>? Days);
}
