# AI Planner - Backend (Phase 1 + Phase 2)

.NET backend for the AI-powered calendar/task/voice-planning platform.

**Phase 1 (Foundation):** clean-architecture skeleton, full DB schema, JWT auth.
**Phase 2 (Core Productivity - this update):** Tasks, Appointments, Today
dashboard, Calendar (day/week/month), create/edit/delete, complete/cancel/
reopen, reschedule, and basic reminders. Still no voice/AI (Phase 3), no
notification *delivery* (Phase 4 - reminders are recorded now, but nothing
pushes them to a device yet), and no mobile/web client code yet.

## Stack

- .NET 10 / ASP.NET Core Web API
- **Aspire 13** for local dev orchestration (auto-starts SQL Server in a
  container, wires the connection string, gives a dashboard with logs/traces/
  health for every resource)
- Entity Framework Core 10 (Code First) targeting **SQL Server Express**
- JWT bearer access tokens + rotating refresh tokens
- BCrypt password hashing
- Swagger / OpenAPI

## Project layout

```
backend/
  AiPlanner.sln
  src/
    AiPlanner.Domain/           # entities, enums - no dependencies
    AiPlanner.Application/      # business logic, interfaces, DTOs, validators
      Auth/                     # register/login/refresh/logout
      Tasks/                    # to-dos, incl. "Ongoing" open-ended tasks
      Appointments/             # scheduled events, reschedule, participants
      Today/                    # the Today dashboard aggregation
      Calendar/                 # day/week/month range queries
      Common/Utils/             # UserTimeZoneHelper - all date math goes through this
    AiPlanner.Infrastructure/   # EF Core config, JWT, password hashing, DI wiring
    AiPlanner.Api/               # controllers, Program.cs, appsettings
    AiPlanner.AppHost/          # Aspire orchestrator - run THIS project in dev
    AiPlanner.ServiceDefaults/  # shared OpenTelemetry/health-check/resilience wiring
  tests/
    AiPlanner.Application.Tests/
```

Dependencies only point inward: Api -> Infrastructure/Application -> Domain.
Application never references Infrastructure (it uses base EF Core types like `DbSet`, but never a database provider).

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- **Docker Desktop (or Podman) running** - Aspire uses it to start the SQL
  Server container for you
- `dotnet-ef` tool: `dotnet tool install --global dotnet-ef`

## Run it

```bash
cd backend
dotnet run --project src/AiPlanner.AppHost
```

Starts SQL Server in a container, injects the connection string into the API,
and opens the Aspire dashboard (defaults to `http://localhost:15200`) with
logs/traces/health for both. The API's Swagger UI is linked from there.

## Configure secrets

```bash
cd src/AiPlanner.Api
dotnet user-secrets init
dotnet user-secrets set "Jwt:Secret" "$(openssl rand -base64 48)"
dotnet user-secrets set "AiProvider:ApiKey" "sk-..."   # used starting Phase 3
```

## Create and apply the initial migration

With the AppHost running:

```bash
cd backend
dotnet ef migrations add InitialCreate \
  --project src/AiPlanner.Infrastructure \
  --startup-project src/AiPlanner.Api

dotnet ef database update \
  --project src/AiPlanner.Infrastructure \
  --startup-project src/AiPlanner.Api \
  --connection "<paste the aiplannerdb connection string from the Aspire dashboard's 'sql' resource details>"
```

## Endpoints

```
Auth
  POST   /api/auth/register
  POST   /api/auth/login
  POST   /api/auth/refresh
  POST   /api/auth/logout
  GET    /api/users/me

Tasks
  GET    /api/tasks?status=&priority=&tag=&dueFrom=&dueTo=&includeCompleted=
  GET    /api/tasks/{id}
  POST   /api/tasks
  PUT    /api/tasks/{id}
  PATCH  /api/tasks/{id}/complete
  PATCH  /api/tasks/{id}/cancel
  PATCH  /api/tasks/{id}/reopen
  DELETE /api/tasks/{id}

Appointments
  GET    /api/appointments?from=&to=&status=
  GET    /api/appointments/{id}
  POST   /api/appointments
  PUT    /api/appointments/{id}
  PATCH  /api/appointments/{id}/reschedule
  PATCH  /api/appointments/{id}/complete
  PATCH  /api/appointments/{id}/cancel
  DELETE /api/appointments/{id}

Today
  GET    /api/today?date=2026-09-29   (date optional - defaults to "now" in the user's own timezone)

Calendar
  GET    /api/calendar?view=day|week|month&date=2026-09-29
  GET    /api/calendar?from=<utc>&to=<utc>   (explicit range override)

Health
  GET    /api/health
  GET    /health, /alive   (Aspire liveness/readiness, dev only)
```

All Tasks/Appointments/Today/Calendar endpoints require
`Authorization: Bearer <accessToken>` and are automatically scoped to the
authenticated user - there is no way to read or write another user's data.

## What's deliberately NOT here yet

- Voice upload, transcription, AI extraction, review-screen endpoints (Phase 3)
- Actual notification *delivery* (push/local notifications) - Reminders are
  recorded with a `TriggerAtUtc`, but nothing polls/dispatches them yet (Phase 4)
- Multi-device sync endpoints beyond what optimistic concurrency (RowVersion)
  already protects against (Phase 5)
- Recurring task/appointment instance generation - `RecurrenceRule` exists in
  the schema and can be pointed at from a Task/Appointment, but Phase 2 does
  not yet create the individual occurrences (Phase 6)
- React Native mobile app, React web app

## Notes on design decisions (Phase 2 additions)

- **Timezone-correct "Today"/"Calendar"**: all day-boundary math goes through
  `UserTimeZoneHelper`, which converts the user's stored IANA `TimeZoneId`
  to UTC boundaries - never hardcodes a timezone (spec section 25).
- **Status transitions are explicit actions**: `PATCH .../complete`,
  `.../cancel`, `.../reopen` are separate from the general `PUT` update, so a
  routine field edit can never accidentally resurrect a cancelled task or
  un-complete a finished one.
- **Reminders are idempotent on Update**: re-`PUT`-ing a Task/Appointment with
  a `ReminderMinutesBefore*` value cancels any previous pending reminder and
  creates a fresh one, rather than accumulating duplicates.
- **Reschedule preserves the reminder offset**: moving an appointment keeps
  "remind me 30 minutes before" pointed at the *new* start time rather than
  leaving a stale reminder at the old time.
- **Optimistic concurrency surfaces as 409**: `ExceptionHandlingMiddleware`
  now catches `DbUpdateConcurrencyException` (thrown automatically by EF Core's
  `RowVersion` tokens) and returns 409 Conflict, so two devices editing the
  same item never silently clobber each other.
- **Tags are auto-created per user**: sending a tag name on a Task that
  doesn't exist yet creates it; existing tags are reused case-insensitively.
