# Gatazee - Product Spec v2 (UX simplification)

Status: proposal, 2026-10-31. Replaces the "Main screen", "Capturing" and AI-classification parts of the
current spec. Everything not mentioned here stays as it is (items model, reminders, repeats, item page,
Edit form, calendar sync, settings, 17 languages, web = app).

Design goal: **one obvious way to do each thing.** Capture is one button; the feed is one list with one
row of chips; search lives only in the search box.

---

## 1. The product in one paragraph

Gatazee is a personal planner you talk to. You say or type a thought; the AI turns it into one entry
(Task, Event or Note) and saves it; you get reminded. Android app + web app (phone-width web behaves
like the app), 17 languages incl. right-to-left.

## 2. Items (unchanged model, sharper definitions)

| Type | Definition (what the AI and the user see) | Row control |
|---|---|---|
| **Task** | Something **to do**, with or without a date. Can be completed. | Checkbox |
| **Event** | Something that **happens at a time** (start, optional end). | Time badge ("16:00") |
| **Note** | Something **to keep**: a fact, idea, reference, link, receipt. Nothing to do. | Document icon |

Shared attributes (all types): title, text, priority, place, people, tags, photos/documents, reminders.
Tasks and events can repeat. Any item can be changed to another type in Edit.

**New default:** every Event gets a reminder **15 minutes before** unless the user says otherwise
("no reminder", or names a different one). The default is a setting (Settings - Notifications - "Remind
me before events": Off / 5 / 15 / 30 / 60 min, default 15).

## 3. Main screen

### 3.1 Layout (Android and web at phone width)

```
┌─────────────────────────────────────────┐
│ Gatazee                          (status) │  App bar: title only
├─────────────────────────────────────────┤
│ 🔍 Search…                          🎤   │  Search box (+ voice search)
│ [All][Tasks][Events][Notes] │ [Open][Today][Media]  [⚙] │  One chip row, scrolls sideways
├─────────────────────────────────────────┤
│ OVERDUE                                  │  Section headers
│ ☐ Renew passport            due Tue      │  Row: control · title · one indicator
│ TODAY                                    │
│ 16:00  Dentist – Dr. Levi     🔔 15:45   │
│ ☐ Buy oat milk               🔔 17:30   │
│ UPCOMING                                 │
│ Thu 20:00  Noa's birthday dinner         │
│ NO DATE                                  │
│ ☐ Book a table for Friday                │
│ 📄 Gift ideas for Noa                    │
│ ▸ Done (12)                              │  Collapsed
│                                     (◉)  │  Capture FAB (mic + pencil)
├─────────────────────────────────────────┤
│  Feed    Today    Calendar    Settings   │  Bottom navigation
└─────────────────────────────────────────┘
```

### 3.2 Component hierarchy

```
AppShell
├── AppBar (title)
├── Screen (by bottom-nav tab)
│   └── FeedScreen
│       ├── SearchBox (text + voice-search mic, clear ×)
│       ├── ChipBar (one horizontal row)
│       │   ├── TypeChips: All · Tasks · Events · Notes      (one at a time)
│       │   ├── ToggleChips: Open · Today · With media        (combinable)
│       │   └── FiltersButton ⚙ (badge = number of extra filters on)
│       ├── ActiveFilterChips (only when the ⚙ sheet set something; removable)
│       ├── FeedList (sections, infinite scroll)
│       │   ├── SectionHeader (Overdue / Today / Upcoming / No date / Notes / Done▸)
│       │   └── FeedRow
│       │       ├── StatusControl (checkbox | time badge | note icon)
│       │       ├── Title (search words highlighted)
│       │       └── Indicator (exactly one, see 3.4)
│       └── FiltersSheet (bottom sheet: When · Status · Reminders · Made · Created · Tags · Sort)
├── CaptureFAB (floating, every screen)  →  CaptureSheet
├── SavedToast ("Saved: …  [Undo] [Edit]")
└── BottomNav: Feed · Today · Calendar · Settings
```

### 3.3 Order (default, no sort controls on screen)

Sections, in this order; inside each, chronological:
1. **Overdue** - open tasks past due (oldest first).
2. **Today** - today's events and due tasks, by time; all-day tasks first.
3. **Upcoming** - by date, then time.
4. **No date** - open tasks without a date, newest first.
5. **Notes** - newest first (only under All / Notes).
6. **Done** - completed tasks and passed events, collapsed, newest first.

While searching: one list "Best matches" (unchanged). Manual sort (Newest, Oldest, Recently updated,
High priority first) moves into the ⚙ sheet as "Sort: Smart (default) / Newest / Oldest / Recently
updated", plus a "High priority first" switch.

### 3.4 Feed row (triage only)

- **Status control:** Task = checkbox (tap = complete), Event = time badge, Note = document icon.
- **Title** (two lines max), search words highlighted.
- **One indicator, first that applies:** next reminder (🔔 time, highlighted if today) → due/start
  date if not today → repeat icon → for notes, the first line of text.
- Not on the row any more: mic icon, place, people, tags, priority badge (high priority = a thin
  accent bar on the row's edge instead of a badge). All of it stays on the item page.
- Tap = open. Long-press = select (Delete with Undo). Swipe is not added (one gesture vocabulary).

### 3.5 Chips

- Type chips are exclusive (All is default). Toggle chips combine with them: "Tasks + Open + Today".
- **Open** = not done (tasks open, events not passed; notes count as open).
- **Today** = due/starting today (+ overdue tasks).
- **With media** = has a photo or document.
- Everything else (When, Status details, Reminders, Made by, Created, Tags, Sort) is in ⚙.
- Removed: the Quick-view row (Upcoming, Overdue, Done, Voice notes, Recently changed) - their
  meaning is covered by the sections (Overdue, Upcoming, Done) and by ⚙.

### 3.6 Navigation

- Bottom navigation: **Feed · Today · Calendar · Settings** (replaces the type tabs and the header
  icons). The capture FAB floats above it on every screen.
- Item pages open on top with a back arrow (unchanged).

## 4. Capture

### 4.1 Triggers

- **Tap the FAB** - the capture sheet opens with the keyboard up (text box focused) and the mic
  ready; tap the mic to talk.
- **Press and hold the FAB** - records at once; **release = send** (Save). Slide away before
  releasing = cancel. (Today: hold starts recording but release does nothing; it changes to send.)
- Widget, Share-into-Gatazee: unchanged (they also Save directly).

### 4.2 One button: Save

- The sheet has **one** primary action, **Save** (also Enter). The "Review" button goes.
- **Auto-save** when the entry is clear:
  - no question from the AI, and
  - the AI's confidence ≥ 0.7, and
  - required fields present (an Event has a date and start time; a repeating task has a date).
  - Then it is saved and a toast shows: `Saved: "Dentist – Dr. Levi" · Tue 16:00   [Undo] [Edit]`
    (5 s). Undo deletes it (with its recording); Edit opens the Edit form.
- **Review fallback**: otherwise the Edit form opens pre-filled (same as today's review), with the
  AI's question on top and the unclear fields marked. Save/Cancel as today.
- Adding to an existing item (from its page) is unchanged.

### 4.3 Capture never searches

- The capture sheet, FAB, widget and share always **create**. "Find my car keys" = a Task "Find car
  keys". The AI's FIND mode is removed from capture.
- Search by voice: the 🎤 in the search box. It transcribes only (no AI call), and the words go into
  the search box. (Optional later: let the search box understand "overdue tasks" etc.)

## 5. AI instructions (entity classification and intent)

Replaces the "Item types" section and removes the "FIND" section of the extraction prompt.

```
TYPES. Every message becomes exactly ONE item of one of these types:

- "task": something the user (or someone for them) has to DO - an action that can be done
  and ticked off - with or without a date.
  Signs: a verb of doing (buy, call, find, fix, send, pay, book, renew, ask, check, pick up, return,
  remember to ...), "I need to / I have to / I should / don't forget / remind me to".
  "Find my car keys", "look for the charger", "think about the gift" are tasks.
  A task never needs a date. A deadline ("by Friday") is its date.

- "appointment": something that HAPPENS AT A TIME, usually with someone or somewhere -
  a meeting, visit, class, flight, call booked for a time, a show, a party.
  It needs a date and a start time; if the user gives a day but no time, ask in "clarification"
  ("What time is it?") and leave "time" null. A duration or end ("for an hour", "until 5")
  sets "endTime".

- "note": something to KEEP, with nothing to do: a fact, a number, a code, an idea, a quote,
  a recipe, a list of options, a link, a receipt, "the wifi password is ...", "Noa likes lilies".
  A note has no date or time of its own.

How to decide, in this order:
1. A specific time at which something takes place -> "appointment".
2. Otherwise, anything to be done -> "task" (even without a date, even phrased as a wish).
3. Otherwise -> "note".
A question to yourself ("what should I get Noa?") is a task only if it asks to act ("decide what
to get Noa"); otherwise a note with the user's words.
"Remind me to X" is a task X with a reminder. "Remind me that Y" (a fact) is a note Y with a reminder.

Never search. Requests like "find", "show", "where is" describe something TO DO and become a task.

REMINDERS FOR APPOINTMENTS. If the user names no reminder for an appointment, return
"reminders": [] - the app adds the user's default. If the user says they want no reminder
("no reminder", "don't remind me"), set "noReminder": true.

CONFIDENCE. "confidence" (0-1): how sure you are of the type, the title and the date/time together.
Below 0.7 if the type is a guess, the date or time is a guess, or the message is ambiguous. If you
would ask something, put it in "clarification" and keep confidence below 0.7.
```

Server rules that go with it (not left to the AI):
- `noReminder` (new boolean in the schema). If an appointment has no reminders and `noReminder` is
  false -> add the user's default "before" reminder (`ExtractionNormalizer`, tested).
- Auto-save threshold: confidence ≥ 0.7 and no clarification and valid (`CaptureService.SaveNowAsync`).
- The `search` field is dropped from the capture schema; `FeedSearch` stays only for the search box.

## 6. Implementation plan

| # | Change | Where | Size |
|---|---|---|---|
| 1 | AI: new TYPES section, no FIND, `noReminder`, confidence rule; default event reminder in the normalizer; setting "Remind me before events" | prompt, schema, ExtractionNormalizer (+tests), UserSettings + migration, Settings UI | M |
| 2 | Capture: one Save; auto-save threshold; toast with Undo + Edit; hold-FAB = record, release = send, slide = cancel | CaptureBar / CaptureDock (web + app), CaptureService.SaveNowAsync, shared/captureDraft | M |
| 3 | Navigation: bottom nav Feed · Today · Calendar · Settings; remove type tabs and header icons | app tab layout, web App shell + CSS | M |
| 4 | Feed: chip bar (type + Open/Today/Media + ⚙), ⚙ sheet with filters + sort; remove quick views, sort chips row, filter button | FeedFilterBar, FeedScreen/FeedPage, shared/feedFilter + feedViews + sortCriteria | M |
| 5 | Smart order with sections (Overdue / Today / Upcoming / No date / Notes / Done▸) | FeedPager (new "Smart" sort, tested), shared/feed grouping, collapsed Done | M |
| 6 | Feed row: control + title + one indicator; priority as edge bar | FeedRow (web + app), shared/feed `rowIndicator()` (tested) | S |
| 7 | Search box mic (transcribe only) | new `POST /api/transcribe` (rate-limited "ai", metered), SearchBox (web + app) | S |
| 8 | Docs + QA: CLAUDE.md decisions, store screenshots, QA scripts (feed-filters, capture) | | S |

Order: 1 → 2 (the capture loop, biggest win) → 3 → 4 → 5 → 6 → 7 → 8. Each step ships on its own
(web deploy + APK).

### Risks and trade-offs

- **Smart order vs "newest first":** people who use the feed as a journal lose the default. Mitigation:
  "Sort: Newest" in ⚙ is remembered per device.
- **Auto-save mistakes:** a wrong guess saved silently. Mitigation: the threshold, the toast's Undo/Edit,
  and the AI's question always forcing the review.
- **Removing tags/place from rows:** less scannable for heavy taggers; tags remain searchable and filterable.
- **Removing voice "Find":** a shipped feature goes; the search-box mic replaces it.
- **Default event reminder:** existing events are not changed; only new captures and new events.
