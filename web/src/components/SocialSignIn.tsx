import type { ExternalSignIn } from '@shared/types'
import { currentLanguage, t } from '@shared/i18n'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { IoLogoApple } from 'react-icons/io5'
import { authApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'

// The providers' own scripts (Google Identity Services, Sign in with Apple JS).
const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client'
const APPLE_SCRIPT = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'

interface GoogleId {
  initialize: (o: { client_id: string; callback: (r: { credential?: string }) => void; nonce?: string; ux_mode?: string; use_fedcm_for_prompt?: boolean }) => void
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
}
interface AppleAuth {
  init: (o: { clientId: string; scope: string; redirectURI: string; usePopup: boolean; nonce?: string }) => void
  signIn: () => Promise<{ authorization: { id_token: string }; user?: { name?: { firstName?: string; lastName?: string } } }>
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
    AppleID?: { auth: AppleAuth }
  }
}

const loaded = new Map<string, Promise<void>>()
function loadScript(src: string) {
  if (!loaded.has(src)) {
    loaded.set(
      src,
      new Promise<void>((resolve, reject) => {
        const s = document.createElement('script')
        s.src = src
        s.async = true
        s.onload = () => resolve()
        s.onerror = () => {
          loaded.delete(src)
          reject(new Error('script'))
        }
        document.head.appendChild(s)
      }),
    )
  }
  return loaded.get(src)!
}

/** A fresh random nonce per attempt: the server checks the token carries it (no replayed tokens). */
const newNonce = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')

/**
 * "Continue with Google / Apple" under the sign-in form (user's request,
 * 2026-10-12). Only the providers the server has ids for are shown; the
 * first sign-in makes the account. Same as the app's SocialSignIn.
 */
export function SocialSignIn({ onError }: { onError: (message: string | null) => void }) {
  const { signInWith } = useAuth()
  const providers = useQuery({ queryKey: ['auth', 'providers'], queryFn: authApi.providers, staleTime: Infinity, retry: false })
  const googleBox = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const google = providers.data?.googleClientId
  const apple = providers.data?.appleServicesId && providers.data.appleRedirectUri ? providers.data : null

  const finish = async (signIn: ExternalSignIn) => {
    setBusy(true)
    onError(null)
    try {
      await signInWith(signIn)
    } catch (err) {
      onError(err instanceof Error ? err.message : t('auth.socialFailed'))
      setBusy(false)
    }
  }

  // Google draws its own button (its rules); a fresh nonce for every page load.
  useEffect(() => {
    if (!google || !googleBox.current) return
    let gone = false
    const nonce = newNonce()
    loadScript(GOOGLE_SCRIPT)
      .then(() => {
        if (gone || !window.google || !googleBox.current) return
        window.google.accounts.id.initialize({
          client_id: google,
          nonce,
          ux_mode: 'popup',
          callback: (r) => (r.credential ? void finish({ provider: 'google', idToken: r.credential, nonce }) : onError(t('auth.socialFailed'))),
        })
        window.google.accounts.id.renderButton(googleBox.current, {
          type: 'standard',
          theme: document.documentElement.dataset.theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: googleBox.current.clientWidth || 320,
          locale: currentLanguage(),
        })
      })
      .catch(() => !gone && onError(t('auth.socialFailed')))
    return () => {
      gone = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google])

  const signInWithApple = async () => {
    if (!apple) return
    onError(null)
    try {
      await loadScript(APPLE_SCRIPT)
      const nonce = newNonce()
      window.AppleID!.auth.init({ clientId: apple.appleServicesId!, scope: 'name email', redirectURI: apple.appleRedirectUri!, usePopup: true, nonce })
      const r = await window.AppleID!.auth.signIn()
      const name = [r.user?.name?.firstName, r.user?.name?.lastName].filter(Boolean).join(' ')
      await finish({ provider: 'apple', idToken: r.authorization.id_token, nonce, displayName: name || undefined })
    } catch (err) {
      // Closing Apple's popup is not an error worth showing.
      if (!(err && typeof err === 'object' && 'error' in err && (err as { error: string }).error === 'popup_closed_by_user')) {
        onError(t('auth.socialFailed'))
      }
    }
  }

  if (!google && !apple) return null
  return (
    <div className="social-sign-in" aria-busy={busy}>
      <div className="social-or">
        <span>{t('auth.or')}</span>
      </div>
      {google && <div ref={googleBox} className="google-button" />}
      {apple && (
        <button type="button" className="apple-button" onClick={() => void signInWithApple()} disabled={busy}>
          <IoLogoApple aria-hidden />
          {t('auth.withApple')}
        </button>
      )}
    </div>
  )
}
