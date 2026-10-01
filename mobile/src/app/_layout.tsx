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
  const { user } = useAuth()

  useEffect(() => {
    if (user !== undefined) SplashScreen.hideAsync()
  }, [user])

  if (user === undefined) return null
  if (user === null) return <AuthScreen />

  return <SignedIn />
}

/** The signed-in app; also keeps the phone's notifications in sync (Phase 4). */
function SignedIn() {
  const c = useColors()
  useNotifications()

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.bg },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="today" options={{ title: 'Today' }} />
      <Stack.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Stack.Screen name="task/[id]" options={{ title: 'Task' }} />
      <Stack.Screen name="appointment/[id]" options={{ title: 'Appointment' }} />
      <Stack.Screen name="note/[id]" options={{ title: 'Note' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  )
}
