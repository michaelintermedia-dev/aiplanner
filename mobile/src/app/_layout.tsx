import Ionicons from '@expo/vector-icons/Ionicons'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DarkTheme, DefaultTheme, Tabs, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { Pressable, Text, useColorScheme } from 'react-native'
import { ApiError } from '@/api/client'
import { AuthProvider } from '@/auth/AuthProvider'
import { useAuth } from '@/auth/useAuth'
import { AuthScreen } from '@/components/AuthScreen'
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

/** Shows the sign-in screen until there is a user, then the tabs. */
function Gate() {
  const { user, logout } = useAuth()
  const c = useColors()

  useEffect(() => {
    if (user !== undefined) SplashScreen.hideAsync()
  }, [user])

  if (user === undefined) return null
  if (user === null) return <AuthScreen />

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        headerShadowVisible: false,
        headerRight: () => (
          <Pressable onPress={logout} hitSlop={8} style={{ paddingHorizontal: 16 }} accessibilityRole="button">
            <Text style={{ color: c.muted }}>Sign out</Text>
          </Pressable>
        ),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => <Ionicons name="sunny-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => <Ionicons name="checkbox-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}
