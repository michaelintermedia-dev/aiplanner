import { t } from '@shared/i18n'
import { useState } from 'react'
import { IoDownloadOutline, IoTrashOutline } from 'react-icons/io5'
import { authApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'

/**
 * Settings - Account (production prep, 2026-10-12): download everything in the
 * account, or delete it for good (typing the email to confirm). Same as the
 * app's AccountCard.
 */
export function AccountCard() {
  const { user, logout } = useAuth()
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [typed, setTyped] = useState('')
  if (!user) return null
  const confirmed = typed.trim().toLowerCase() === user.email.toLowerCase()

  const download = async () => {
    setBusy('export')
    setError(null)
    try {
      const zip = await authApi.exportData()
      const url = URL.createObjectURL(zip)
      const a = document.createElement('a')
      a.href = url
      a.download = `ai-planner-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!confirmed) return
    setBusy('delete')
    setError(null)
    try {
      await authApi.deleteAccount(typed.trim())
      await logout() // the session is gone with the account; back to the sign-in page
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      setBusy(null)
    }
  }

  return (
    <section className="card form account-card">
      <h3>{t('account.title')}</h3>
      <p className="muted small">{t('account.signedInAs', { email: user.email })}</p>

      <div className="account-action">
        <button onClick={() => void download()} disabled={busy !== null}>
          <IoDownloadOutline aria-hidden /> {busy === 'export' ? t('account.exporting') : t('account.export')}
        </button>
        <p className="muted small">{t('account.exportHint')}</p>
      </div>

      <div className="account-action">
        {!deleting ? (
          <button className="danger-button" onClick={() => setDeleting(true)} disabled={busy !== null}>
            <IoTrashOutline aria-hidden /> {t('account.delete')}
          </button>
        ) : (
          <div className="account-delete" role="group" aria-label={t('account.delete')}>
            <p>{t('account.deleteHint')}</p>
            <label>
              {t('account.deleteConfirm', { email: user.email })}
              <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
            </label>
            <div className="account-delete-buttons">
              <button onClick={() => (setDeleting(false), setTyped(''))} disabled={busy !== null}>
                {t('common.cancel')}
              </button>
              <button className="danger-button" onClick={() => void remove()} disabled={!confirmed || busy !== null}>
                <IoTrashOutline aria-hidden /> {busy === 'delete' ? t('account.deleting') : t('account.deleteForever')}
              </button>
            </div>
          </div>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  )
}
