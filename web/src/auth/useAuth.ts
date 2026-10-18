import { createContext, useContext } from 'react'
import type { AuthResponse, ExternalSignIn, User } from '@shared/types'
import type { ZoneContext } from '@shared/dates'
import type { Language } from '@shared/i18n'

export interface AuthState {
  /** undefined while the stored session is being restored on startup */
  user: User | null | undefined
  /** The user's timezone and locale; all dates in the UI are shown in this zone. */
  zone: ZoneContext
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  /** Sign in (or up, the first time) with Google / Apple. */
  signInWith: (signIn: ExternalSignIn) => Promise<void>
  logout: () => Promise<void>
  /** New tokens from the server (a changed or reset password): keep going with them. */
  adoptSession: (auth: AuthResponse) => Promise<void>
  /** Reads the account again (e.g. after confirming the email). */
  reloadUser: () => Promise<void>
  /** Saves the UI language on the account (all devices follow it). */
  changeLanguage: (language: Language) => Promise<void>
  /** Moves the account to another time zone (IANA id); all devices follow it. */
  changeTimeZone: (timeZoneId: string) => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
