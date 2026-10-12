import { t } from '@shared/i18n'
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { IoMailOutline } from 'react-icons/io5'
import { authApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'

/**
 * "Confirm your email" with the 6-digit code (production prep, 2026-10-12):
 * shown while the account's email isn't confirmed and the server sends email.
 * The AI waits for it (the server says email_unconfirmed). Same as the app's.
 */
export function EmailConfirmBanner() {
  const { user, reloadUser } = useAuth()
  const providers = useQuery({ queryKey: ['auth', 'providers'], queryFn: authApi.providers, staleTime: Infinity, retry: false })
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  if (!user || user.emailConfirmed !== false || !providers.data?.emailEnabled) return null

  const confirm = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await authApi.verifyEmail(code)
      await reloadUser() // the banner goes away
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : t('common.error'), error: true })
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setMessage(null)
    try {
      await authApi.sendVerification()
      setMessage({ text: t('email.sent') })
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : t('common.error'), error: true })
    }
  }

  return (
    <form className="card email-confirm" onSubmit={(e) => void confirm(e)} aria-label={t('email.confirmTitle')}>
      <strong>
        <IoMailOutline aria-hidden /> {t('email.confirmTitle')}
      </strong>
      <p className="muted small">{t('email.confirmBody', { email: user.email })}</p>
      <div className="email-confirm-row">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          aria-label={t('email.code')}
          maxLength={12}
        />
        <button type="submit" className="primary" disabled={busy || code.replace(/\D/g, '').length !== 6}>
          {t('email.confirm')}
        </button>
      </div>
      <button type="button" className="link" onClick={() => void resend()}>
        {t('email.resend')}
      </button>
      {message && <p className={message.error ? 'error' : 'muted small'}>{message.text}</p>}
    </form>
  )
}
