# AI Planner - Web

React web client for the AI Planner backend (spec section 5).

**Stack:** Vite, React 19, TypeScript (strict), React Router, TanStack Query.
No UI component library - styling is plain CSS with light/dark themes in
`src/index.css`.

## Run it

Normally you don't start this directly: the Aspire AppHost runs it together
with SQL Server and the API:

```bash
cd backend
dotnet run --project src/AiPlanner.AppHost
```

The web app's URL is shown in the Aspire dashboard (http://localhost:15200)
under the `web` resource.

To run it on its own against an already-running API:

```bash
cd web
npm install
npm run dev        # http://localhost:3000, proxies /api to https://localhost:58442
```

## Layout

```
src/
  api/          client.ts (the only place that does HTTP, token refresh),
                endpoints.ts (typed API from ../shared)
  auth/         AuthProvider + useAuth: session restore, login/register/logout,
                and the user's timezone/locale
  lib/          useAction.ts
  components/   TaskRow, QuickAddTask, AppointmentRow, AppointmentForm
  pages/        AuthPage, TodayPage, TasksPage, CalendarPage
```

API types, endpoint definitions and date helpers (`@shared/types`,
`@shared/endpoints`, `@shared/dates`) live in `../shared` and are shared with
the mobile app.

## Conventions

- **HTTP only through `src/api`.** Components call `tasksApi.create(...)`
  etc., never `fetch` (spec section 29).
- **Reads use `useQuery`, writes use `useAction`**, which refetches all
  queries afterwards so Today, Tasks and Calendar stay consistent.
- **Dates are shown and entered in the user's profile timezone**, not the
  browser's. Use the helpers in `@shared/dates`; the API always speaks UTC.
- **Date-only tasks** are sent as midnight at the start of that day in the
  user's timezone, with `hasDueTime: false`.
- **Tokens:** the access token is kept in memory only; the refresh token is in
  localStorage so a reload keeps the session. Refresh tokens rotate on every
  use, so `refreshSession()` shares one in-flight request between callers.
