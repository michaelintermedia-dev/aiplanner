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

Full product spec (all 46 sections) was provided by the user at project
start — ask the user if you need the original spec doc; it is not repeated
here in full, only the decisions and constraints that shape implementation.

## Mandatory stack — do not substitute without explicit user request

- **Backend**: .NET 10 / ASP.NET Core, C#, EF Core 10 (Code First), REST API,
  clean/layered architecture (Domain / Application / Infrastructure / Api)
- **Database**: Microsoft SQL Server Express (schema must stay compatible
  with scaling to a larger SQL Server edition later)
- **Mobile**: React Native, shared codebase for iOS + Android (not yet built)
- **Web**: React (not yet built)
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
mobile/    # not started
web/       # not started
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
dotnet user-secrets set "AiProvider:ApiKey" "sk-..."        # for Phase 3
```

Migrations (with AppHost running):
```bash
dotnet ef migrations add InitialCreate --project src/AiPlanner.Infrastructure --startup-project src/AiPlanner.Api
dotnet ef database update --project src/AiPlanner.Infrastructure --startup-project src/AiPlanner.Api --connection "<from Aspire dashboard's 'sql' resource>"
```

The backend was originally written without a compiler. It was first built
and its unit tests passed on 2026-09-30, after the .NET 10 migration and fixes
for missing package/framework references. It has **not yet been run
end-to-end** (no migration created, no API calls exercised against a real
database) — treat that as the next verification step.

## Status by phase (spec section 42)

- ✅ **Phase 1 — Foundation**: solution skeleton, full DB schema (all entities
  from spec section 9), JWT auth (register/login/refresh/logout), Aspire
  orchestration.
- ✅ **Phase 2 — Core Productivity**: Tasks (CRUD + Ongoing/Complete/Cancel/
  Reopen), Appointments (CRUD + participants + Reschedule), Today dashboard,
  Calendar (day/week/month), basic reminders (recorded, not yet delivered).
- ⬜ **Phase 3 — Voice & AI**: voice upload, speech-to-text, OpenAI-backed
  extraction (`ITranscriptionService`, `IAiExtractionService` — interfaces
  not yet written), AI review screen. **This is next.**
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
- ⬜ **Mobile (React Native) / Web (React)**: not started at all.

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
- **AI/transcription must stay provider-agnostic behind interfaces**
  (`ITranscriptionService`, `ISummarizationService`, `ITitleGenerationService`,
  `IIntentExtractionService` — per spec section 16). Clients never call
  OpenAI directly; everything routes through the .NET backend. When building
  Phase 3, define these interfaces in Application, implement them in
  Infrastructure using OpenAI's API, and validate AI output before persisting
  (spec section 17 — "Do not blindly trust AI output").
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
- New entities: inherit `BaseEntity` (gives `Id`, `UserId`, timestamps,
  `IsDeleted`, `RowVersion`) unless there's a specific reason not to
  (e.g. `User` itself, join tables like `TaskTag`).

## What NOT to do

- Don't reintroduce `docker-compose.yml` for local dev — Aspire replaced it.
- Don't add AI/OpenAI calls directly from a controller — go through an
  Application-layer interface implemented in Infrastructure.
- Don't skip the explicit complete/cancel/reopen actions in favor of letting
  `PUT` change status — this was a deliberate safety decision.
- Don't assume runtime behavior is correct just because it compiles — the
  services have not yet been exercised against a real database.
