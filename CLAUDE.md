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
  Web capture/review done (see Web below). Next: mobile capture/review.
- ⬜ **Phase 4 — Notifications**: actual push/local notification delivery.
  Reminder *records* already exist (`Reminder` entity, `TriggerAtUtc`) from
  Phase 2 — Phase 4 is about dispatching them, not creating them.
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
  Today, Tasks (quick add with native date/time pickers, complete; long-press
  to cancel/delete), Calendar week agenda, pull-to-refresh. Verified on the
  Android emulator in Expo Go; iOS not tested (needs a Mac). No appointment
  creation or edit forms yet, no automated tests yet.

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

## What NOT to do

- Don't reintroduce `docker-compose.yml` for local dev — Aspire replaced it.
- Don't add AI/OpenAI calls directly from a controller — go through an
  Application-layer interface implemented in Infrastructure.
- Don't skip the explicit complete/cancel/reopen actions in favor of letting
  `PUT` change status — this was a deliberate safety decision.
- Don't assume runtime behavior is correct just because it compiles —
  exercise new endpoints against the running app before calling them done.
