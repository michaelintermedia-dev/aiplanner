import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getStoredRefreshToken, hasStoredSession, refreshSession, setOnSessionExpired, setSession } from '../api/client'
import { authApi } from '../api/endpoints'
import type { AuthResponse, User } from '@shared/types'
import type { ZoneContext } from '@shared/dates'
import { localeFor } from '@shared/i18n'
import { AuthContext, type AuthState } from './useAuth'

const browserZone: ZoneContext = {
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  locale: navigator.language,
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null | undefined>(hasStoredSession() ? undefined : null)

  const signOutLocally = useCallback(() => {
    setSession(null)
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    setOnSessionExpired(signOutLocally)
    if (!hasStoredSession()) return
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
    setSession(auth)
    setUser(await authApi.me())
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      zone: user ? { timeZone: user.timeZoneId, locale: user.locale } : browserZone,
      login: async (email, password) => startSession(await authApi.login(email, password)),
      register: async (email, password, displayName) =>
        startSession(await authApi.register(email, password, displayName, browserZone.timeZone, browserZone.locale)),
      logout: async () => {
        const refreshToken = getStoredRefreshToken()
        if (refreshToken) await authApi.logout(refreshToken).catch(() => {})
        signOutLocally()
      },
      changeLanguage: async (language) => setUser(await authApi.updateProfile({ locale: localeFor(language, browserZone.locale) })),
    }),
    [user, startSession, signOutLocally],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
