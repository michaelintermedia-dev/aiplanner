# AI Planner - Mobile

React Native app for iOS and Android (spec section 4), built with Expo.

**Stack:** Expo SDK 57, React Native 0.86, Expo Router (file-based tabs),
TanStack Query, expo-secure-store, @react-native-community/datetimepicker.

## Development build (needed for notifications)

Since Phase 4 the app runs as a **development build** - its own app
"AI Planner" (`com.aiplanner.app`) with the native modules built in - instead
of Expo Go. Expo Go SDK 57 can't post notifications on Android (reminders
would never appear). The app still opens in Expo Go, just without them.

Build the APK (first build ~30 min, then 1-2 min; needs Android Studio's JDK):

```powershell
cd mobile
npx expo prebuild --platform android      # generates android/ (gitignored)
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
cd android
.\gradlew.bat assembleDebug '-PreactNativeArchitectures=arm64-v8a'   # phone
# emulator: '-PreactNativeArchitectures=x86_64'
```

The APK is `android/app/build/outputs/apk/debug/app-debug.apk`. Install it
over USB (`adb install -r app-debug.apk`) or copy it to the phone and open it
(allow "install unknown apps" once). Rebuild only when native things change
(new native package, app.json permissions/plugins); JS changes come from
Metro as before.

Then start Metro (`npx expo start`), open **AI Planner** on the phone, and
connect to `http://<PC's Wi-Fi IP>:8081` from the dev launcher (or scan the
QR code with the phone's camera). On the emulator:

```bash
adb reverse tcp:8081 tcp:8081 && adb reverse tcp:58443 tcp:58443
adb shell am start -a android.intent.action.VIEW -d "aiplanner://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"
```

Notes: allow notifications when asked. `USE_EXACT_ALARM` (app.json) makes
reminders go off on the minute - without it Android delays them by up to an
hour. The emulator's small data partition may refuse big APKs; build it for
`x86_64` only.

## Run it on the Android emulator (Expo Go)

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

## Run it on a physical Android phone (Wi-Fi)

The phone and the PC must be on the same Wi-Fi network.

1. **Expo Go must match the project's SDK (57).** The Play Store version may
   be older ("Project is incompatible with this version of Expo Go"). Install
   the matching one over USB (USB debugging on) from the Expo CLI's cache,
   and decline Play Store "updates" back to the older version:
   ```bash
   adb install -r %USERPROFILE%\.expo\android-apk-cache\Expo-Go-57.0.9.apk
   ```
2. **Windows Firewall, once:** allow ports 8081 (Metro) and 58443 (API) from
   the local network only. In an administrator PowerShell:
   ```powershell
   New-NetFirewallRule -DisplayName 'AI Planner dev - Expo Metro (8081)' -Direction Inbound -Protocol TCP -LocalPort 8081 -RemoteAddress LocalSubnet -Action Allow -Profile Any
   New-NetFirewallRule -DisplayName 'AI Planner dev - API (58443)' -Direction Inbound -Protocol TCP -LocalPort 58443 -RemoteAddress LocalSubnet -Action Allow -Profile Any
   ```
3. Start the backend (as above) and `npx expo start` in `mobile/`.
4. In Expo Go, scan the QR code from the terminal, or "Enter URL manually":
   `exp://<PC's Wi-Fi IP>:8081` (find the IP with `ipconfig`).

The AppHost binds the API's http endpoint to all interfaces
(`TargetHost = "0.0.0.0"`) for this. Over USB instead of Wi-Fi, run
`adb reverse tcp:8081 tcp:8081` and `adb reverse tcp:58443 tcp:58443` and
open `exp://127.0.0.1:8081`.

## Which API it talks to

`src/api/client.ts` uses **the host the app was loaded from** (Expo's
`hostUri`) with port 58443 - so it follows Metro automatically: the PC's
Wi-Fi IP for a phone on the network, `127.0.0.1` over USB with
`adb reverse`. `EXPO_PUBLIC_API_URL` overrides it. Without a dev host it falls
back to `http://10.0.2.2:58443` (Android emulator) or `http://localhost:58443`.

It uses plain HTTP because phones and emulators don't trust the local dev
certificate; the API only allows that in Development.

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
