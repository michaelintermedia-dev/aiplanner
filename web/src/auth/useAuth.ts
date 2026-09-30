import { createContext, useContext } from 'react'
import type { User } from '../api/types'
import type { ZoneContext } from '../lib/dates'

export interface AuthState {
  /** undefined while the stored session is being restored on startup */
  user: User | null | undefined
  /** The user's timezone and locale; all dates in the UI are shown in this zone. */
  zone: ZoneContext
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
