import { useState, type FormEvent } from 'react'
import { t } from '@shared/i18n'
import { useAuth } from '../auth/useAuth'

export function AuthPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password, displayName)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth">
      <form className="card form auth-card" onSubmit={submit}>
        <h1 className="brand">{t('app.name')}</h1>
        <p className="muted">{mode === 'login' ? t('auth.signInPrompt') : t('auth.registerPrompt')}</p>
        {mode === 'register' && (
          <label>
            {t('auth.name')}
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required autoComplete="name" />
          </label>
        )}
        <label>
          {t('auth.email')}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          {t('auth.password')}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === 'register' ? 8 : undefined}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="primary wide" disabled={busy}>
          {mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}
        </button>
        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError(null)
          }}
        >
          {mode === 'login' ? t('auth.toRegister') : t('auth.toSignIn')}
        </button>
      </form>
    </main>
  )
}
