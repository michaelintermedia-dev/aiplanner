# AI Planner - Mobile

React Native app for iOS and Android (spec section 4), built with Expo.

**Stack:** Expo SDK 57, React Native 0.86, Expo Router (file-based tabs),
TanStack Query, expo-secure-store, @react-native-community/datetimepicker.

## Run it on the Android emulator

1. Start the backend (SQL Server + API) from the repo root:
   ```bash
   cd backend
   dotnet run --project src/AiPlanner.AppHost
   ```
2. Start the emulator (Android Studio > Device Manager, or
   `emulator -avd Medium_Phone_API_36.1`).
3. Start the app:
   ```bash
   cd mobile
   npm install        # first time only
   npm run android    # starts Metro and opens the app in Expo Go
   ```

If Expo Go gets stuck on "Bundling 99%", route Metro through adb and open it
on localhost instead:

```bash
adb reverse tcp:8081 tcp:8081
adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" host.exp.exponent
```

Don't start Metro with `CI=1`: in CI mode it stops watching files, so code
changes never reach the app.

## Which API it talks to

`src/api/client.ts` picks the API URL:

| Where the app runs | Default URL |
|---|---|
| Android emulator | `http://10.0.2.2:58443` (the emulator's alias for the host machine) |
| iOS simulator | `http://localhost:58443` |
| Physical phone | set `EXPO_PUBLIC_API_URL`, e.g. `http://192.168.1.50:58443` |

It uses plain HTTP because emulators don't trust the local dev certificate;
the API only allows that in Development. A physical phone also needs the API
to listen on the network, not just localhost - not set up yet.

## Layout

```
src/
  app/          Expo Router screens: _layout.tsx (providers, sign-in gate,
                tabs), index.tsx (Today), tasks.tsx, calendar.tsx
  api/          client.ts (the only place that does HTTP, token refresh),
                endpoints.ts (typed API from ../shared)
  auth/         AuthProvider + useAuth: session restore, login/register/logout
  components/   TaskRow, AppointmentRow, QuickAddTask, DateTimeField, ui.tsx
  lib/          useAction.ts
  theme.ts      light/dark palette (same colors as the web app)
```

API types, endpoint definitions and date helpers are shared with the web app
from `../shared` (see `metro.config.js`).

## Conventions

Same as the web app (see ../CLAUDE.md, "Client-side"): HTTP only through
`src/api`, dates in the user's profile timezone, one in-flight token
refresh. The refresh token is stored with expo-secure-store (Keychain on iOS,
Keystore on Android); the access token stays in memory.

Install packages with `npx expo install <package>` so versions match the
Expo SDK.
