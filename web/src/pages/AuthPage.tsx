import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { t } from '@shared/i18n'
import { authApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { SocialSignIn } from '../components/SocialSignIn'

type Mode = 'login' | 'register' | 'forgot' | 'reset'

export function AuthPage() {
  const { login, register, adoptSession } = useAuth()
  const providers = useQuery({ queryKey: ['auth', 'providers'], queryFn: authApi.providers, staleTime: Infinity, retry: false })
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const go = (next: Mode) => {
    setMode(next)
    setError(null)
    setCode('')
    if (next === 'reset' || next === 'forgot') setPassword('')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'login') await login(email, password)
      else if (mode === 'register') await register(email, password, displayName)
      else if (mode === 'forgot') {
        // "Forgot password?" (production prep, 2026-10-12): a code by email, then a new password.
        await authApi.forgotPassword(email)
        go('reset')
      } else await adoptSession(await authApi.resetPassword(email, code, password))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  const prompt = {
    login: t('auth.signInPrompt'),
    register: t('auth.registerPrompt'),
    forgot: t('auth.forgotPrompt'),
    reset: t('auth.resetPrompt', { email }),
  }[mode]
  const action = { login: t('auth.signIn'), register: t('auth.createAccount'), forgot: t('auth.sendCode'), reset: t('auth.resetSave') }[mode]

  return (
    <main className="auth">
      <form className="card form auth-card" onSubmit={submit}>
        <h1 className="brand">
          <img src="/icon-192.png" alt="" className="brand-logo" /> {t('app.name')}
        </h1>
        <p className="muted">{prompt}</p>
        {mode === 'register' && (
          <label>
            {t('auth.name')}
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required autoComplete="name" />
          </label>
        )}
        {mode !== 'reset' && (
          <label>
            {t('auth.email')}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
        )}
        {mode === 'reset' && (
          <label>
            {t('email.code')}
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" required maxLength={12} />
          </label>
        )}
        {mode !== 'forgot' && (
          <label>
            {mode === 'reset' ? t('password.new') : t('auth.password')}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'login' ? undefined : 8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>
        )}
        {error && <p className="error">{error}</p>}
        <button type="submit" className="primary wide" disabled={busy}>
          {action}
        </button>
        {mode === 'login' && providers.data?.emailEnabled && (
          <button type="button" className="link" onClick={() => go('forgot')}>
            {t('auth.forgot')}
          </button>
        )}
        {mode === 'login' || mode === 'register' ? (
          <button type="button" className="link" onClick={() => go(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? t('auth.toRegister') : t('auth.toSignIn')}
          </button>
        ) : (
          <button type="button" className="link" onClick={() => go('login')}>
            {t('auth.backToSignIn')}
          </button>
        )}
        {(mode === 'login' || mode === 'register') && <SocialSignIn onError={setError} />}
      </form>
    </main>
  )
}
