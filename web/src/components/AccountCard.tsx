import { t } from '@shared/i18n'
import { useState, type FormEvent } from 'react'
import { IoDownloadOutline, IoKeyOutline, IoLogOutOutline, IoTrashOutline } from 'react-icons/io5'
import { authApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'

/**
 * Settings - Account (production prep, 2026-10-12): the password (change it, or
 * set one on a Google/Apple-only account), sign out of all devices, download
 * everything, delete it for good (the email - and the password, if there is
 * one - confirm it). Same as the app's AccountCard.
 */
export function AccountCard() {
  const { user, logout, adoptSession } = useAuth()
  const [busy, setBusy] = useState<'export' | 'delete' | 'password' | 'signout' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [typed, setTyped] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [changing, setChanging] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  if (!user) return null
  const hasPassword = user.hasPassword !== false
  const confirmed = typed.trim().toLowerCase() === user.email.toLowerCase() && (!hasPassword || deletePassword.length > 0)

  const run = async (what: NonNullable<typeof busy>, work: () => Promise<void>) => {
    setBusy(what)
    setError(null)
    setNotice(null)
    try {
      await work()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setBusy(null)
    }
  }

  const download = () =>
    run('export', async () => {
      const zip = await authApi.exportData()
      const url = URL.createObjectURL(zip)
      const a = document.createElement('a')
      a.href = url
      a.download = `ai-planner-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    })

  const savePassword = (e: FormEvent) => {
    e.preventDefault()
    if (next.length < 8) return setError(t('password.tooShort'))
    void run('password', async () => {
      await adoptSession(await authApi.changePassword(next, hasPassword ? current : undefined))
      setChanging(false)
      setCurrent('')
      setNext('')
      setNotice(t('password.changed'))
    })
  }

  const signOutAll = () =>
    run('signout', async () => {
      await authApi.signOutEverywhere()
      await logout()
    })

  const remove = () => {
    if (!confirmed) return
    void run('delete', async () => {
      await authApi.deleteAccount(typed.trim(), hasPassword ? deletePassword : undefined)
      await logout() // the session is gone with the account; back to the sign-in page
    })
  }

  return (
    <section className="card form account-card">
      <h3>{t('account.title')}</h3>
      <p className="muted small">{t('account.signedInAs', { email: user.email })}</p>

      <div className="account-action">
        {!changing ? (
          <>
            <button onClick={() => setChanging(true)} disabled={busy !== null}>
              <IoKeyOutline aria-hidden /> {hasPassword ? t('password.change') : t('password.set')}
            </button>
            {!hasPassword && <p className="muted small">{t('password.setHint')}</p>}
          </>
        ) : (
          <form className="account-password" onSubmit={savePassword}>
            {hasPassword && (
              <label>
                {t('password.current')}
                <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
              </label>
            )}
            <label>
              {t('password.new')}
              <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required />
            </label>
            <div className="account-delete-buttons">
              <button type="button" onClick={() => (setChanging(false), setCurrent(''), setNext(''))} disabled={busy !== null}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="primary" disabled={busy !== null}>
                {t('common.save')}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="account-action">
        <button onClick={() => void signOutAll()} disabled={busy !== null}>
          <IoLogOutOutline aria-hidden /> {t('account.signOutAll')}
        </button>
        <p className="muted small">{t('account.signOutAllHint')}</p>
      </div>

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
            {hasPassword && (
              <label>
                {t('account.deletePassword')}
                <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} autoComplete="current-password" />
              </label>
            )}
            <div className="account-delete-buttons">
              <button onClick={() => (setDeleting(false), setTyped(''), setDeletePassword(''))} disabled={busy !== null}>
                {t('common.cancel')}
              </button>
              <button className="danger-button" onClick={remove} disabled={!confirmed || busy !== null}>
                <IoTrashOutline aria-hidden /> {busy === 'delete' ? t('account.deleting') : t('account.deleteForever')}
              </button>
            </div>
          </div>
        )}
      </div>
      {notice && <p className="muted">{notice}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  )
}
