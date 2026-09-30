import type { AuthResponse } from '@shared/types'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

// Single place where HTTP happens (spec section 29). Screens call the typed
// functions in endpoints.ts, never fetch() directly.
//
// Tokens: the short-lived access token lives only in memory; the refresh token
// is kept in the platform keychain/keystore via expo-secure-store.

/**
 * API base URL. The Android emulator reaches the host machine at 10.0.2.2; the
 * iOS simulator can use localhost. For a physical device, set
 * EXPO_PUBLIC_API_URL to the computer's LAN address (see mobile/README.md).
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:58443' : 'http://localhost:58443')

const REFRESH_TOKEN_KEY = 'aiplanner.refreshToken'

let accessToken: string | null = null
let refreshInFlight: Promise<boolean> | null = null
let onSessionExpired: () => void = () => {}

export class ApiError extends Error {
  readonly status: number
  readonly errors: string[]

  constructor(status: number, errors: string[], title?: string) {
    super(errors.length > 0 ? errors.join(' ') : (title ?? `Request failed (${status})`))
    this.status = status
    this.errors = errors
  }
}

export async function setSession(auth: AuthResponse | null) {
  accessToken = auth?.accessToken ?? null
  if (auth) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, auth.refreshToken)
  else await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)
}

export function getStoredRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
}

export function setOnSessionExpired(handler: () => void) {
  onSessionExpired = handler
}

/**
 * Exchanges the stored refresh token for a new access token. Refresh tokens
 * rotate on every use, so concurrent callers must share one request - a second
 * parallel refresh would present an already-revoked token and fail.
 */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    const refreshToken = await getStoredRefreshToken()
    if (!refreshToken) return false
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!response.ok) {
      await setSession(null)
      return false
    }
    await setSession((await response.json()) as AuthResponse)
    return true
  })().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { title?: string; errors?: unknown }
    const errors = Array.isArray(body.errors) ? body.errors.map(String) : []
    return new ApiError(response.status, errors, body.title)
  } catch {
    return new ApiError(response.status, [])
  }
}

export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  { anonymous = false }: { anonymous?: boolean } = {},
): Promise<T> {
  const send = () =>
    fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(!anonymous && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

  let response: Response
  try {
    response = await send()
  } catch {
    throw new ApiError(0, [`Can't reach the server at ${API_URL}.`])
  }

  if (response.status === 401 && !anonymous) {
    if (await refreshSession()) {
      response = await send()
    } else {
      onSessionExpired()
    }
  }

  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
