import type { AuthResponse } from './types'

// Single place where HTTP happens (spec section 29). UI code calls the typed
// functions in endpoints.ts, never fetch() directly.
//
// Token storage: the short-lived access token lives only in memory. The
// refresh token is kept in localStorage so a reload doesn't log the user out.
// That is readable by any script on the page, so the planned hardening is to
// move it to an HttpOnly cookie issued by the API.

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

function readRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

function writeRefreshToken(token: string | null) {
  try {
    if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token)
    else localStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch {
    // Storage unavailable (private mode etc.) - the session just won't survive a reload.
  }
}

export function setSession(auth: AuthResponse | null) {
  accessToken = auth?.accessToken ?? null
  writeRefreshToken(auth?.refreshToken ?? null)
}

export function hasStoredSession() {
  return readRefreshToken() !== null
}

export function getStoredRefreshToken() {
  return readRefreshToken()
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
    const refreshToken = readRefreshToken()
    if (!refreshToken) return false
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!response.ok) {
      setSession(null)
      return false
    }
    setSession((await response.json()) as AuthResponse)
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
    fetch(`/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(!anonymous && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

  let response = await send()

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
