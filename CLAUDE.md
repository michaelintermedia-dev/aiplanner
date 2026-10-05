# AI Planner — Project Context for Claude Code

This file is read automatically by Claude Code at the start of every session
in this repo. It exists so you don't have to re-explain the project each
time — treat it as the source of truth for scope, decisions already made,
and what's next.

## What this is

A personal AI planning assistant: calendar + to-do + appointments +
reminders + notifications, driven by natural-language text or voice input.
Core loop:

> Think → Speak or Type → AI Understands → Review → Save → Get Reminded

The full product spec (all 46 sections) is in [docs/SPEC.md](docs/SPEC.md) —
read the relevant sections before starting a phase or feature. "Spec section
N" references in code and docs point there. This file holds only the
decisions and constraints that shape implementation; where the two differ,
the decisions recorded here win (e.g. .NET 10).

## Mandatory stack — do not substitute without explicit user request

- **Backend**: .NET 10 / ASP.NET Core, C#, EF Core 10 (Code First), REST API,
  clean/layered architecture (Domain / Application / Infrastructure / Api)
- **Database**: Microsoft SQL Server Express (schema must stay compatible
  with scaling to a larger SQL Server edition later)
- **Mobile**: React Native via Expo (SDK 57, Expo Router), one codebase for
  iOS + Android
- **Web**: React 19 + TypeScript (strict), Vite, React Router, TanStack Query
- **AI provider**: OpenAI (user has their own API key, to be wired in Phase 3)
- **Local dev orchestration**: Aspire 13 (NOT docker-compose — see below)

Migrated from .NET 8 to .NET 10 at the user's request (2026-09-30). Aspire
13 ships as an MSBuild SDK (`Aspire.AppHost.Sdk/13.x`) — no workload needed.
FluentValidation is held at 11.x and FluentAssertions at 6.x on purpose
(FA 8+ is commercially licensed) — don't bump those majors without asking.

## Repo layout

```
backend/
  AiPlanner.sln
  src/
    AiPlanner.Domain/           # entities, enums — zero dependencies
    AiPlanner.Application/      # business logic, interfaces, DTOs, validators
      Auth/                     # register/login/refresh/logout
      Tasks/                    # to-dos, incl. "Ongoing" open-ended tasks
      Appointments/             # scheduled events, reschedule, participants
      Today/                    # Today dashboard aggregation
      Calendar/                 # day/week/month range queries
      Common/Utils/             # UserTimeZoneHelper — ALL date math goes through this
    AiPlanner.Infrastructure/   # EF Core config, JWT, password hashing, DI wiring
    AiPlanner.Api/              # controllers, Program.cs, appsettings
    AiPlanner.AppHost/          # Aspire orchestrator — run THIS to develop locally
    AiPlanner.ServiceDefaults/  # shared OpenTelemetry/health-check/resilience wiring
  tests/
    AiPlanner.Application.Tests/
web/       # React web client - see web/README.md
mobile/    # Expo React Native app - see mobile/README.md
shared/    # dependency-free TS shared by web + mobile: API types,
           # endpoint definitions (createApi), timezone date helpers,
           # captureDraft (review-screen item <-> confirm payload)
docs/
  SPEC.md  # full product spec
```

Dependency rule: Api → Infrastructure/Application → Domain. Application
never references Infrastructure — everything goes through interfaces in
`Application/Common/Interfaces` (`IApplicationDbContext`,
`ICurrentUserService`, `IDateTime`, `IPasswordHasher`, `ITokenService`),
which Infrastructure implements. Application *does* reference the base
`Microsoft.EntityFrameworkCore` package (for `DbSet<T>` and LINQ async
operators like `ToListAsync`), but never a provider package
(`.SqlServer`) — the database provider stays in Infrastructure.

## How to run it locally

```bash
cd backend
dotnet run --project src/AiPlanner.AppHost
```

This starts SQL Server in a Docker container (`MSSQL_PID=Express`), wires
the connection string into the API automatically, and opens the Aspire
dashboard. **Docker Desktop (or Podman) must be running** — Aspire drives it,
you never run `docker` commands directly. `docker-compose.yml` was
deliberately removed in favor of this.

First-time setup:
```bash
dotnet tool install --global dotnet-ef
cd src/AiPlanner.Api
dotnet user-secrets init
dotnet user-secrets set "Jwt:Secret" "$(openssl rand -base64 48)"
dotnet user-secrets set "AiProvider:ApiKey" "sk-..."        # OpenAI; models are set in appsettings.json
```

Migrations (with AppHost running):
```bash
dotnet ef migrations add InitialCreate --project src/AiPlanner.Infrastructure --startup-project src/AiPlanner.Api
dotnet ef database update --project src/AiPlanner.Infrastructure --startup-project src/AiPlanner.Api --connection "<from Aspire dashboard's 'sql' resource>"
```

The backend was originally written without a compiler. On 2026-09-30 it was
built, migrated (`InitialCreate`) and smoke-tested end-to-end through Aspire
against the SQL Server container: auth, tasks (incl. lifecycle actions),
appointments, Today, Calendar, validation, and cross-user isolation all
worked. There are still no automated integration tests — only validator
unit tests.

Local dev notes:
- The AppHost `http` launch profile sets `ASPIRE_ALLOW_UNSECURED_TRANSPORT`.
- The web app is always http://localhost:5173 (pinned in the AppHost, not
  proxied; Vite has strictPort, so a busy port fails instead of moving).
- The API listens on https://localhost:58442 and http://localhost:58443. In
  Development, plain HTTP is served without redirecting so the Android
  emulator (http://10.0.2.2:58443) can reach it; elsewhere it redirects.
- The SQL `sa` password is generated by Aspire and stored in the AppHost's
  user secrets (`Parameters:sql-password`); the container's host port is
  random — find it with `docker port <sql-container> 1433`.
- `ApplicationDbContext` is registered with plain `AddDbContext` +
  `EnrichSqlServerDbContext`, NOT Aspire's pooled `AddSqlServerDbContext`,
  because it depends on the scoped `ICurrentUserService`. Keep it that way.
- All DateTimes are read back as `DateTimeKind.Utc` via
  `UtcDateTimeConverter` (registered in `ConfigureConventions`).
- Request DTOs are validated by the global `ValidationFilter` (Api/Filters)
  — just add an `AbstractValidator<T>`; no manual validate calls needed.

## Status by phase (spec section 42)

- ✅ **Phase 1 — Foundation**: solution skeleton, full DB schema (all entities
  from spec section 9), JWT auth (register/login/refresh/logout), Aspire
  orchestration.
- ✅ **Phase 2 — Core Productivity**: Tasks (CRUD + Ongoing/Complete/Cancel/
  Reopen), Appointments (CRUD + participants + Reschedule), Today dashboard,
  Calendar (day/week/month), basic reminders (recorded, not yet delivered).
- 🟡 **Phase 3 — Voice & AI**: backend done, clients not yet.
  `api/captures` (text + voice upload → transcript → AI title/summary/items
  → user confirms → real tasks/appointments/notes, in one transaction),
  capture history, audio playback/deletion. `ITranscriptionService` +
  `IIntentExtractionService` (OpenAI: gpt-4o-mini-transcribe - gpt-4o-transcribe
  dropped everything after the first pause in resumed recordings -
  and gpt-5.4-mini with a strict JSON schema); `ExtractionNormalizer` validates all AI output and does
  the timezone conversion (unit tested). Verified live against OpenAI on
  2026-09-30: English + Russian text, a WAV voice upload (~5-7 s per
  capture), confirm/reject/edit, duplicate-confirm refusal, audio delete.
  Web and mobile capture/review done (see Web / Mobile below). Voice
  captures can have several audio parts (`VoiceCapture.AudioStorageKeys`,
  a JSON column); `GET /api/captures/{id}/audio?part=N`.
- 🟡 **Phase 4 — Notifications** (2026-10-02): the backend owns the rules,
  clients deliver (spec section 23). `GET /api/notifications/upcoming?hours=`
  returns every occurrence due in the window (reminders with repeating ones
  expanded, snoozes, the daily summary "3 tasks due today · 1 overdue · 2
  events"), honouring `GET/PUT /api/settings/notifications` (master switch,
  task/event reminders, daily summary + time). Rules are pure and tested in
  `NotificationSchedule`. Keys are stable per occurrence (`r:{reminder}:{ticks}`,
  `s:{snooze}`, `d:{date}`). `POST /api/notifications/snooze` stores a
  `Notification` row. Today's "upcoming reminders" come from the same list.
  Web: `useNotificationDelivery` shows browser notifications while a tab is
  open (Settings page asks for permission). Mobile: `useNotifications`
  schedules them as local notifications (cap 60), re-syncing on launch,
  foreground, every 15 min and after every change (it's a query, and every
  mutation invalidates all queries); actions Done / Snooze 15 min / 1 hour;
  tapping opens the item. Not yet: remote push when the app was never opened
  (needs push tokens + a sender), web push with the tab closed.
- ⬜ **Phase 5 — Synchronization**: multi-device sync, conflict resolution.
  Groundwork already in place: `BaseEntity.IsDeleted` (soft delete) +
  `RowVersion` (optimistic concurrency, surfaces as HTTP 409) on every
  owned entity.
- ⬜ **Phase 6 — Advanced**: recurring task/appointment *instance generation*
  (the `RecurrenceRule` entity and FK already exist in the schema from
  Phase 1, but nothing generates occurrences from it yet), search, voice
  history, widgets, calendar integrations, analytics.
- 🟡 **Web (React)**: sign in/up, Today with AI quick capture (text box +
  mic via MediaRecorder → review screen where every item is editable →
  Save/Cancel), Tasks (manual quick add, complete/cancel/reopen/delete),
  Calendar (day/week/month) with appointment creation. Runs under the Aspire
  AppHost as the `web` resource. No edit forms for saved items yet, no
  automated tests yet (verified by driving Chrome with Playwright, using a
  WAV file as a fake microphone for the voice path).
- 🟡 **Mobile (React Native / Expo)**: sign in/up with session restore,
  Today with AI quick capture (text + big mic: hold/tap, segments, level
  meter, silence warning, listen, send; review screen with editable items),
  Tasks (quick add with native date/time pickers, complete; long-press to
  cancel/delete), Calendar (Day/Week/Month like web: month grid with dots,
  week strip, selected day listed below), pull-to-refresh. Verified on the
  Android emulator in Expo Go (the emulator mic is the host's default Windows
  input, which was silent on this machine, so real speech wasn't tested
  on-device); iOS not tested (needs a Mac). No appointment creation or edit
  forms for saved items yet, no automated tests yet.

## Design decisions already made — follow these, don't re-litigate

- **User isolation**: every query in every service filters by
  `UserId` via `ICurrentUserService`. Never trust a client-supplied user id.
- **Soft deletes everywhere**: set `IsDeleted = true`, never physically
  delete, via a global EF Core query filter. This exists for Phase 5 sync.
- **Optimistic concurrency**: every owned entity has SQL Server `RowVersion`.
  `DbUpdateConcurrencyException` is caught centrally in
  `ExceptionHandlingMiddleware` → HTTP 409. Don't add manual version checks
  in services — EF handles it automatically.
- **Timezone-correct date logic**: ALL "today"/date-range logic goes through
  `UserTimeZoneHelper` (converts the user's stored IANA `TimeZoneId` to UTC
  boundaries). Never hardcode UTC-as-local or use `DateTime.Today`.
- **Status transitions are explicit actions**: `PATCH .../complete`,
  `.../cancel`, `.../reopen` are separate endpoints from the general `PUT`
  update, specifically so a routine field edit can never silently resurrect
  a cancelled task or un-complete a finished one. Keep this pattern for any
  new entity with a lifecycle.
- **AI/transcription stays provider-agnostic behind interfaces**:
  `ITranscriptionService` and `IIntentExtractionService` (Application/Ai),
  implemented in Infrastructure/Ai. Title, summary and items come from ONE
  extraction call rather than separate title/summarization services (the
  spec's list in section 16 is "for example") - cheaper and consistent.
  Clients never call OpenAI directly.
- **Never trust AI output**: the model returns wall-clock local dates/times
  as strings; `ExtractionNormalizer` parses, range-checks and converts them to
  UTC, and turns anything unusable into a `Clarification` for the user. New
  AI fields must go through it, with tests.
- **Nothing AI-proposed is saved as a task/appointment until the user
  confirms** (spec section 18). Confirm is all-or-nothing
  (`IApplicationDbContext.ExecuteInTransactionAsync`) and refuses items that
  were already decided, so it can't create duplicates.
- **Don't log user content** (transcripts, captured text) - counts, ids and
  timings only (spec section 37). Audio lives in `IFileStorageService`
  (App_Data locally), never in SQL.
- **Reminders are idempotent on Update**: re-`PUT`-ing a Task/Appointment
  with a reminder value cancels the old pending reminder and creates a new
  one rather than accumulating duplicates. Follow this pattern in Phase 3/4.
- **Tags auto-create per user, case-insensitive lookup.**
- **Aspire over docker-compose**, intentionally — gives connection string
  wiring, retry-on-failure, health checks, and a unified dashboard for logs/
  traces as more resources (background workers, notification schedulers)
  get added in later phases.
- **docx/pptx/xlsx-style "make a file" requests**: not applicable here, this
  is pure backend code — ignore any generic file-creation skill guidance
  that doesn't apply to a .NET solution.

## Navigation model (decided with the user, 2026-10-01)

- **The home screen is one unified feed** of tasks, events (= appointments;
  "Event" in the UI) and notes, newest first, infinite scroll, day headers.
  Sorts: Newest / Oldest / Recently updated / By date (undated last).
- **Filters, not sections**: mobile bottom tabs are All · Tasks · Events ·
  Notes, each the same `FeedScreen` with a kind filter; on web the same as
  tabs on `/feed?show=…`. Every row opens its detail view
  (`task/[id]`, `appointment/[id]`, `note/[id]`; web `/tasks/:id` …).
- **Web mirrors the mobile app** (user's call - keep them looking and
  behaving the same): no sidebar; a header with title, back arrow on inner
  pages, and Today / Calendar / account icons; the filter bar fixed at the
  bottom; the "⇅ Newest" sort chip; the big round mic. Icons are Ionicons on
  both (`@expo/vector-icons` on mobile, `react-icons/io5` on web). When
  changing one app's UI, change the other to match.
- Today and Calendar stay as date-based views (header icons on both). The
  capture bar sits on top of the feed.
- API: `GET /api/feed?kinds=&sort=&cursor=&take=`. `FeedService` loads small
  key rows for all the user's items, `FeedPager` (pure, unit-tested) orders
  and pages them with a keyset cursor, then details load for one page only.
  Fine for personal-scale data; revisit (SQL UNION + keyset) if a user ever
  has tens of thousands of items. Shared grouping/labels: `shared/feed.ts`.
- **Feed filters** (2026-10-02, web + mobile): Filter button next to the sort
  chip; one set of filters for every tab, kept when the tab changes (mobile:
  a tiny shared store, `lib/feedFilters.ts`). Text (title/details/note/
  location/tags), created (today/7d/30d/dates), when (due/start: today/this
  week/overdue/no date), status (open/done - passed events count as done),
  reminders (has/repeating/none), from voice, tags (any of; tasks only). The
  server filters (`GET /api/feed?q=&createdFrom=...`, `GET /api/feed/tags`), so
  paging still works; `shared/feedFilter.ts` turns choices into UTC ranges in
  the user's timezone. Notes drop out of status/date filters, events and notes
  out of tag filters (they have no status/date/tags).
- **Sort criteria as round chips** (2026-10-02, web + mobile; replaced the
  single "⇅ Newest" menu). The ⇅ "Sort by" chip opens an editor: pick
  criteria (High priority first, Newest, Oldest, Recently updated, By date)
  (one icon each - no colours, the icon identifies it); Save shows them as
  round chips. Tapping a chip switches it off (pale tint, dashed grey ring)
  or on (filled, green ring) and the
  feed re-sorts by the chips that are on, in order (`shared/sortCriteria.ts`;
  default = High priority + Newest). Kept per device (web localStorage,
  mobile SecureStore via `lib/sortChips.ts`). API: `GET /api/feed?sort=A,B`
  (FeedPager compares by each in turn; the cursor carries the priority flag);
  with priority first, high-priority tasks group under "High priority". To
  add a criterion (e.g. "Relevant"): FeedSort enum + FeedPager.CompareBy +
  SORT_CRITERIA + an icon in each app's SortChips.
- **Reminder on feed rows** (2026-10-03, web + mobile): a bell (repeat icon
  for daily/weekdays/weekly) with the next time it goes off, highlighted when
  it's today. `FeedItemDto.NextReminderUtc/ReminderRepeats`, worked out per
  page with `NotificationSchedule.Occurrences` so it matches what will fire;
  paused/off reminders don't count. Label: `feedReminder()` in shared/feed.ts.
- **Deleting from the feed** (2026-10-02, web + mobile): "Select" chip (mobile
  also long-press a row) enters select mode - a bar with N selected / Select
  all / Delete; web rows also have a trash button on hover for one item. No
  confirm dialog: an Undo toast (`UNDO_MS`, `useItemDeletion`) instead.
  `POST /api/items/delete` and `/api/items/restore` take `{ items: [{ itemType,
  id }] }` of any mix (`ItemDeletionService`); delete pauses reminders with
  the item (`PausedWithItem`) so restore brings them back - except on a
  completed/cancelled item, where they wait for reopen.
- Notes have full CRUD (`/api/notes`) and are created by confirming a Note
  item in a capture, or directly.
- **A capture never dead-ends; any item can be any type** (user's rule).
  If the AI finds nothing actionable (a question, a stray thought), it returns
  a Note with the user's words — the prompt says so, and
  `ExtractionNormalizer` adds that Note itself if the AI still returns no
  items. The review always shows all three types (Task / Event / Note,
  `INTENT_OPTIONS` in `shared/captureDraft.ts`) plus editable dates,
  time, priority, reminder and details, so the user can turn anything into
  anything and fill in what's missing before saving.
- **Everything that changes an item happens in its Edit page** (user's call,
  2026-10-05, web + mobile; replaced the view's Type chips, "Add more" and
  "Delete recording"). The view is read / listen / Complete-Cancel-Reopen,
  plus Edit and a mic shortcut (Edit with recording on; `?edit=1` / `?talk=1`).
  `ItemEditor` (one form for every type, `shared/itemForm.ts`): Type chips
  (`switchType`; a note's "before" reminders become one-off ones), fields,
  reminders, details, and on top "Change it by voice or text" - a
  `CaptureBar` with `continueFrom.onResult`: the AI's whole-item proposal is
  merged into the form (`applyProposal`: only what it changed vs the saved
  item, so several additions and hand edits combine) and the changed fields
  are marked; unrelated words become "Also capture ... as a new entry"
  (captured after Save, reviewed on the page - `FollowUpReview`). Nothing is
  saved until Save (`saveItemForm`: convert if the type changed, the normal
  PUT, then confirm the proposals with `linkOnly` so their words/audio clip
  belong to the item, then delete the recording if asked); Cancel rejects the
  proposals (`discardProposals`). Continue calls send `keepEarlier` so earlier
  unsaved additions in the same form stay pending. Items made by hand get a
  capture on first use (`POST /api/captures/for-item`); an empty one isn't
  shown. Unsaved edits are kept on the device (web localStorage, mobile
  `editDrafts`) and restored if the item didn't change meanwhile.
- **Saved items can change type too** (2026-10-02): the Type chips in the
  Edit page call `POST /api/items/convert` (on Save).
  `ItemConversionService` creates the new item through the normal services
  and soft-deletes the old one in one transaction, carrying over title, text,
  date, reminders and the capture link (location goes into the text where the
  type has no field for it). The new item keeps the old one's `CreatedAtUtc`
  (set after the insert so the SaveChanges stamp doesn't overwrite it), so the
  Created filter and Newest/Oldest sorts see the original creation time; a
  plain edit (PUT) never changes the id or created date. An event needs a time: if it had to guess one
  (09:00), `needsDetails` is true and the client opens the new item in edit
  mode (`?edit=1` / `edit: '1'`).
- **A reminder is not a type; every type can carry one** (user's rule,
  2026-10-01). A reminder is a schedule on an item, on until turned off:
  `At` (once at a moment - "in 1 hour", "tomorrow 9:00"), `Before` (N minutes
  before the item's own time; moves with it; not on notes), `Daily`,
  `Weekdays`, `Weekly` (local HH:mm + days). An item can have several
  (`Reminders` lists everywhere; "remind me at 3 and at 4" = two).
  Completing/cancelling an item pauses its reminders (`PausedWithItem`) and
  reopening restores them; ones the user removed stay off.
  Wire format `ReminderDto` / shared `Reminder` is the same on tasks,
  appointments, notes and capture items. All writes go through
  `ReminderPlanner` (Application/Reminders): unchanged = kept, changed = old
  row cancelled + new row; complete/cancel/delete turn it off, reopen restores
  it. `TriggerAtUtc` = next time it goes off (`ReminderSchedule`, pure,
  unit-tested) - Phase 4 dispatches it and advances repeating ones.
  Clients: `ReminderList` of `ReminderPicker`s (web + mobile) with quick
  presets and a small editor, used in the capture review and every edit form;
  labels/presets/validation in `shared/reminders.ts`. The AI returns a
  `reminders` array (kind/minutesBefore/date/time/days); capture items keep
  proposals as JSON (`AIExtractionItem.ProposedReminders`).
  `ExtractionIntent.Reminder` is legacy (= task with a Before-0 reminder).
- **The mobile app runs as a development build, not Expo Go** (2026-10-02).
  Expo Go SDK 57 on Android can't post notifications at all (importing
  expo-notifications throws, and its notification channel provider is missing).
  `npx expo run:android` / `gradlew assembleDebug` builds it (`android/` is
  generated by prebuild and gitignored; package `com.aiplanner.app`).
  `USE_EXACT_ALARM` in app.json is required: without it Android schedules the
  reminders inexactly (up to an hour late). See mobile/README.md.
  `src/lib/expoNotifications.ts` imports only the local-notification parts of
  expo-notifications so the app still loads in Expo Go (without notifications).
- **Mobile only: the new-entry controls are a floating toolbar** (user's
  request, 2026-10-02 - a deliberate exception to keeping web and mobile the
  same). `CaptureDock` wraps the whole signed-in app (root layout), so it
  floats over every screen and a recording survives navigation. Open by
  default; the X or a touch anywhere behind it collapses it to a round mic
  button that can be dragged anywhere and snaps to the nearest side (like
  Expo's dev-tools bubble); a tap reopens it. Collapsing shrinks the toolbar into the button and opening grows it back out of it (Animated, native driver; the button's drag and its pop are two layers, since one view can't mix JS- and native-driven transforms; Reduce motion skips it). It sits above the tab bar on tab
  screens and lifts above the keyboard (edge-to-edge Android doesn't resize). It never collapses while recording/processing/reviewing
  (`CaptureBar onEngagedChange`), and typed text survives collapsing.
  It steps aside on an item's screen (user's call, 2026-10-05 - one mic at a
  time keeps it simple): the item screen has its own mic next to Edit ("talk
  about this item"), registers in `lib/dockTarget` while focused
  (`useHideDock`, via `useEditMode`), and the dock hides - unless a recording
  is going on in it. It stays mounted, so coming back it's as it was.
- **A capture can be continued after saving** (user's request, 2026-10-02;
  since 2026-10-05 from the item's Edit page, see above) - the capture bar
  in continue mode (`CaptureBar continueFrom`, web + mobile).
  `POST /api/captures/{id}/continue` (audio parts and/or text + the item)
  appends the audio to the same recording (one track), the words to the
  transcript, and asks the AI about the new words only, with the earlier text
  and the item's title as context. Proposals that complete the item come back
  `addsToCurrent`; the review offers "Add to this task/event/note" (preselected
  for those). Since 2026-10-03 the AI gets the whole item (`ContinuedItem`
  JSON in its own answer shape, local times) and returns it whole, updated:
  same title/type, details merged, new reminders added, changed date/time/
  place applied. The review shows all its fields (title locked), and confirm
  with `replacesItem` updates the item in place through its service
  (`ApplyToItemAsync`) - same id, title and created date; notes, tags, people
  are kept. Only drafts that came back whole (`ItemDraft.wholeItem`) do this;
  "Add to this" on any other proposal still just appends its text
  (`AppendToItemAsync`), so an item's dates/reminders are never wiped.
  The type can change by voice too, from the item's page only and only on an
  explicit request ("make it an event", "turn this into a note") - a time,
  place or person alone never does it (prompt rule). The review marks it
  ("Changes it from Task to Event", `typeChange`); on save `ApplyToItemAsync`
  converts first (`IItemConversionService`, same transaction - nested
  `ExecuteInTransactionAsync` joins the open one) then updates; the client
  opens the new item (`movedItem`, `ContinueFrom.onMoved`). Save uses
  `mutateAsync`: the refresh unmounts the review, which drops mutate() callbacks.
  Adding to an item is strictly scoped to it (user's rule, 2026-10-03): the AI
  gets only that item and the words said about it (`AIExtractionItem.SourceText`,
  the AI's verbatim quote), never the rest of the message, and exactly one
  proposal is kept - that item. Unrelated words go into its details; other
  items from the same message are never re-read or changed.
  Adding never wipes anything (`ContinuedItem.Keep`, unit-tested): only a
  proposal the AI marked `addsToCurrent` counts - if it proposed a new item
  instead, the item itself is the proposal with the words added to its
  details; date/time/place/priority the AI left out keep the item's values;
  details that lost the old text or the new words get both back. A new
  "Add more" on an item rejects earlier unsaved ones of that capture, and the
  review shows only the item's own proposal (`reviewItems`).
  Words that aren't about the item come back as `unrelated` (prompt + schema,
  `AIExtractionItem.Unrelated`) and stay out of its details; the review offers
  "Also capture “...” as a new entry" (on by default), and after Save the
  capture bar runs a normal capture of them and shows its review
  (`followUpText`, `onDone(message, followUp)`). Each "Add more" proposal
  stores which item it belongs to (`ContinuesItemType/Id`), so an unsaved
  one can be resumed from the banner ("Unsaved addition to “X”").
  A voice addition to a typed capture keeps its recording: the capture gets
  its first VoiceCapture + Transcript (typed words first, then the spoken).
- **Unsaved reviews are never lost** (2026-10-03, web + mobile): the capture
  bar's banner (`usePendingReview`, `GET /api/captures?pendingDays=7`) offers
  the newest one back - Resume / Discard, plus "Discard all N"
  (`POST /api/captures/pending/discard`) when several wait. Edits made in a
  review are kept on the device until Save/Cancel (`reviewDrafts`: web
  localStorage, mobile a JSON file; `restoreDrafts` only reuses them for the
  same proposals). Web also warns before reload/close mid-review. Save is
  disabled with nothing ticked and guarded against double clicks; a type
  change drops the old item's query (`useAction` `forget`) so it isn't
  refetched (404).
- **Each item plays its own part of a voice message** (user's request,
  2026-10-03). The AI quotes each item's words verbatim (`sourceText`);
  `OpenAiTranscriptionService` makes a second, parallel call to `TimingModel`
  (whisper-1 - the only model with word timestamps; `gpt-4o-mini-transcribe`
  still makes the text) and `AudioSnippets` (pure, unit-tested) fuzzily
  aligns the quote to the timed words (Smith-Waterman over tokens, small
  spelling differences allowed). Stored as `AIExtractionItem.AudioStartMs/
  AudioEndMs` on one timeline with parts back to back, plus
  `VoiceCapture.AudioPartDurationsMs`; continued captures place new parts
  after the old ones. Items are matched in the order they were said: a
  phrase said twice finds its own place (`Find(..., notBeforeMs)`). No audio
  is cut - clients play a range: web seeks the joined track and pauses at the
  end (checked every animation frame, so 2× stops on time); mobile starts in the right part
  (`locateInParts`) and stops across parts. "Play this part (0:02-0:05)" +
  "Whole recording" on the item's source capture (`shared/audioSnippet.ts`).
  An item can have several capture items (its words + each later addition):
  `itemClips` collects all of them that have audio (typed additions have
  none), in order, and the players play them back to back.
  If timings fail, items just have no snippet (whole recording).
  Audio is stored once per message (never per item). `RecordingCleanup`
  (run by `RecordingCleanupWorker`, every 6 h) deletes a recording when no
  item from it is left (or none was saved) and nothing about it changed for a
  day - Undo and same-day changes still find it; the transcript stays.
  `Recordings:CleanupDryRun=true` only logs what it would delete.
  After transcription, WAV parts (from the web) are re-encoded to AAC .m4a
  (mono 32 kbit/s, ~9x smaller; same length, so snippet timings still fit) by
  `FfmpegAudioCompressor` behind `IAudioCompressor` - only if ffmpeg is found
  (`Recordings:FfmpegPath` or PATH; otherwise WAV is kept). The phone already
  uploads .m4a. Install locally with `winget install Gyan.FFmpeg`.
  Settings → Recordings → "Shorten pauses" (`UserSettings.ShortenPauses`,
  off by default, `GET/PUT /api/settings/recordings`): on save, pauses over 0.3 s
  are cut to 0.15 s (`PauseTrimmer.MaxPauseMs/KeptPauseMs`). The pauses come from the word timings (not loudness), so
  `PauseTrimmer` moves the timings with the cuts and item snippets stay right.
  WAV is cut in code (`PauseTrimmer.CutWav`), other formats by ffmpeg
  (`IAudioCompressor.CutAsync`); the shorter file gets a new key (storage
  never overwrites - FileMode.CreateNew) and the original is deleted.
  Needs word timings; a part without them is kept as it was.
  Playback speed 1× / 1.5× / 2× (`shared/playbackSpeed.ts`, `SpeedChips` in
  each app) on every player, remembered per device; mobile max is 2×. Mobile
  players count a file's "finished" only once that file was seen playing (a
  fixed delay broke short pieces at 2×) and report position every 100 ms.
- **UI languages: English, Russian, Hebrew; Hebrew is right-to-left**
  (2026-10-02, web + mobile). All UI text goes through `t('key', vars)` from
  `shared/i18n` - never write user-visible English in a component. `en.ts`
  is the reference; `ru.ts`/`he.ts` are typed `Messages`, so a missing key
  is a compile error. Plurals are `{ one, few, many, two, other }` objects
  picked by `count` (rules in `i18n/index.ts` - Hermes has no
  Intl.PluralRules). Shared label lists use getters (`get label()`) so they
  read in the current language. Adding a language = a dictionary file + a
  `LANGUAGES` entry. The language is `User.Locale` (`PATCH /api/users/me`,
  Settings → Language; registration sends the device locale), so all
  devices follow it; dates/numbers use Intl with that locale. The apps call
  `setLocale()` in the root and key the tree by language. RTL: web sets
  `<html dir>` and the CSS uses logical properties (`margin-inline-start`,
  `border-inline-start`, `inset-inline-*`) - never left/right; arrows get
  `.flip-rtl`. Mobile uses `I18nManager.forceRTL` + reload
  (`lib/layoutDirection.ts`; RN swaps left/right styles itself), chevron
  icons flip by hand. Server-made notification texts are translated in
  `NotificationTexts` (per language, unit-tested). Not translated yet: server
  validation/error messages (English), and weeks always start on Monday.
- Icons are standard Ionicons, never emoji, for UI controls (the mic button
  is `mic`/`pause`). Each item type has ONE icon (`KIND_ICON` in
  `components/kindIcons.ts` in each app): the filter tab, feed rows and calendar
  entries all use it; a task's icon doubles as its tick box (square / checkbox).
- Calendar period math (week start, visible days, stepping, titles) lives in
  `shared/calendar.ts`; both apps offer Day / Week / Month with ‹ Today ›.

## Conventions to keep consistent

- DTOs are `record` types, one file per DTO, under
  `Application/<Feature>/DTOs/`.
- Validators are FluentValidation `AbstractValidator<T>`, same folder,
  registered automatically via `AddValidatorsFromAssembly`.
- Services return `Result` / `Result<T>` (see `Application/Common/Models/Result.cs`)
  for expected failures (not found, validation) rather than throwing —
  reserve exceptions for genuinely exceptional cases (auth failure → 401 via
  `UnauthorizedAccessException`, concurrency conflicts).
- Controllers are thin: map `Result.Succeeded` to the right HTTP status,
  no business logic in controllers.
- New rows must be added with `_db.X.Add(entity)`. `BaseEntity` assigns the
  Guid key in its constructor, so an entity only attached through a
  navigation property looks like an existing row to EF and gets an UPDATE
  (surfacing as a 409 concurrency conflict).
- New entities: inherit `BaseEntity` (gives `Id`, `UserId`, timestamps,
  `IsDeleted`, `RowVersion`) unless there's a specific reason not to
  (e.g. `User` itself, join tables like `TaskTag`).

Client-side (web and mobile - keep them consistent):

- Anything both clients need that has no dependencies (API types, endpoint
  paths, date logic) goes in `shared/`, imported as `@shared/...`. Files
  there must not import packages - they can't resolve either app's
  node_modules.
- All HTTP goes through one API client module; UI never calls `fetch`.
- Show and enter dates in the user's **profile** timezone (`User.TimeZoneId`),
  not the device's. A task with a date but no time is sent as midnight at the
  start of that day in the user's timezone, with `hasDueTime: false`.
- Refresh tokens rotate on every use (the old one is revoked), so a client
  must never fire two refreshes in parallel - share one in-flight request.
- **Mic button behavior (same on web and mobile)**, decided with the user:
  one button, press length decides the mode - hold ≥350 ms = push-to-talk
  (release pauses), short tap = toggle (tap starts, tap pauses). Pausing
  never sends: pressing again *continues the same recording*. While paused
  the user can **listen back** to everything so far, then Send or Discard.
  The mic stays at a fixed position (rightmost) so hold-to-talk never
  misses. Recordings cap at 10 minutes.
- **Upload recordings as WAV (16 kHz mono)**, not the browser's WebM:
  OpenAI rejects MediaRecorder WebM once it has been paused/resumed or
  flushed with requestData() ("corrupted or unsupported"). The web app
  converts with `web/src/lib/toWav.ts`; the preview plays that same WAV.
- **Mobile records in segments**: a paused native .m4a isn't playable until
  stopped, so every pause *stops* and finalizes a segment and continuing
  starts a new one (`mobile/src/lib/useSegmentRecorder.ts`). Send uploads all
  segments as repeated `audio` fields; the API transcribes each and joins the
  text in order. A failed Send keeps the recording (never lose what was said).
- **Mobile uploads files as expo-file-system `File`** (`new File(uri)`).
  Expo's fetch - the global fetch in this SDK - rejects React Native's
  `{ uri, name, type }` FormData parts ("Unsupported FormDataPart
  implementation").

## QA agent

`.claude/agents/qa-explorer.md` - exploratory QA, report only (never edits code).
Runs against a separate API copy on :58600 (`tools/qa/start-api.ps1`) and the QA
account `feedtest@test.local` (`tools/qa/seed.cjs` resets + seeds it), drives Chrome
via `tools/qa/lib.cjs` (`openApp`), fake voice via `tools/qa/say.ps1`, an OpenAI
budget per run (`QA_AI_BUDGET`). Reports: `docs/qa/<date>-<area>.md`. Turn
confirmed findings into regression tests. Local-only (gitignored):
`tools/qa/.local/conn.txt` (dev DB connection string), optional `ffmpeg.exe`.

## What NOT to do

- Don't reintroduce `docker-compose.yml` for local dev — Aspire replaced it.
- Don't add AI/OpenAI calls directly from a controller — go through an
  Application-layer interface implemented in Infrastructure.
- Don't skip the explicit complete/cancel/reopen actions in favor of letting
  `PUT` change status — this was a deliberate safety decision.
- Don't assume runtime behavior is correct just because it compiles —
  exercise new endpoints against the running app before calling them done.
