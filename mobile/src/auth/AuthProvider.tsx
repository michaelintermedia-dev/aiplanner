import type { ZoneContext } from '@shared/dates'
import type { AuthResponse, User } from '@shared/types'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getStoredRefreshToken, refreshSession, setOnSessionExpired, setSession } from '@/api/client'
import { authApi } from '@/api/endpoints'
import { AuthContext, type AuthState } from './useAuth'

const deviceZone: ZoneContext = {
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
  locale: Intl.DateTimeFormat().resolvedOptions().locale ?? 'en-US',
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null | undefined>(undefined)

  const signOutLocally = useCallback(async () => {
    await setSession(null)
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  // Restore the session from the stored refresh token on startup.
  useEffect(() => {
    setOnSessionExpired(() => void signOutLocally())
    let cancelled = false
    refreshSession()
      .then((ok) => (ok ? authApi.me() : null))
      .then((me) => !cancelled && setUser(me))
      .catch(() => !cancelled && setUser(null))
    return () => {
      cancelled = true
    }
  }, [signOutLocally])

  const startSession = useCallback(async (auth: AuthResponse) => {
    await setSession(auth)
    setUser(await authApi.me())
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      zone: user ? { timeZone: user.timeZoneId, locale: user.locale } : deviceZone,
      login: async (email, password) => startSession(await authApi.login(email, password)),
      register: async (email, password, displayName) =>
        startSession(await authApi.register(email, password, displayName, deviceZone.timeZone)),
      logout: async () => {
        const refreshToken = await getStoredRefreshToken()
        if (refreshToken) await authApi.logout(refreshToken).catch(() => {})
        await signOutLocally()
      },
    }),
    [user, startSession, signOutLocally],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
