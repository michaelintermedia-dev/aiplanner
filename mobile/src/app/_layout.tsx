import { languageOf, setLocale, t } from '@shared/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { useColorScheme } from 'react-native'
import { ApiError } from '@/api/client'
import { AuthProvider } from '@/auth/AuthProvider'
import { useAuth } from '@/auth/useAuth'
import { AuthScreen } from '@/components/AuthScreen'
import { CaptureDock } from '@/components/CaptureDock'
import { applyLayoutDirection } from '@/lib/layoutDirection'
import { useNotifications } from '@/lib/useNotifications'
import { useColors } from '@/theme'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retrying 4xx responses (validation, not found, auth) never helps.
      retry: (failureCount, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
    },
  },
})

export default function RootLayout() {
  const scheme = useColorScheme()
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="auto" />
          <Gate />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

/**
 * Shows the sign-in screen until there is a user. Signed in, a stack: the tabs
 * at the bottom, with item detail screens pushed on top.
 */
function Gate() {
  const { user, zone } = useAuth()
  // The UI language follows the user's locale (the phone's before signing in).
  const language = languageOf(zone.locale)
  setLocale(zone.locale)

  useEffect(() => {
    if (user !== undefined) SplashScreen.hideAsync()
  }, [user])

  // Hebrew lays out right-to-left; switching direction reloads the app.
  useEffect(() => {
    if (user !== undefined) applyLayoutDirection(zone.locale)
  }, [user, zone.locale])

  if (user === undefined) return null
  // Keyed by language: a language change re-renders every screen.
  if (user === null) return <AuthScreen key={language} />

  return <SignedIn key={language} />
}

/**
 * The signed-in app; also keeps the phone's notifications in sync (Phase 4).
 * The new-entry toolbar floats over every screen (CaptureDock).
 */
function SignedIn() {
  const c = useColors()
  useNotifications()

  return (
    <CaptureDock>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.bg },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="today" options={{ title: t('nav.today') }} />
        <Stack.Screen name="calendar" options={{ title: t('nav.calendar') }} />
        <Stack.Screen name="task/[id]" options={{ title: t('kind.task') }} />
        <Stack.Screen name="appointment/[id]" options={{ title: t('kind.event') }} />
        <Stack.Screen name="note/[id]" options={{ title: t('kind.note') }} />
        <Stack.Screen name="settings" options={{ title: t('nav.settings') }} />
      </Stack>
    </CaptureDock>
  )
}
