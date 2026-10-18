import { t } from '@shared/i18n'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { disableWebPush, enableWebPush, webPushKey, webPushOn, webPushSupported } from '../lib/webPush'

/**
 * Settings - Notifications: "Even when Gatazee is closed" (web push, this
 * browser). Hidden where the browser can't do it or the server has no keys.
 */
export function WebPushToggle() {
  const key = useQuery({ queryKey: ['push', 'key'], queryFn: webPushKey, enabled: webPushSupported(), staleTime: Infinity })
  const [on, setOn] = useState(webPushOn)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!webPushSupported() || !key.data) return null

  const toggle = async (next: boolean) => {
    setBusy(true)
    setError(null)
    try {
      if (next) {
        if (!(await enableWebPush(key.data!))) setError(t('settings.browser.blocked'))
        else setOn(true)
      } else {
        await disableWebPush()
        setOn(false)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <label className="settings-row">
        <div>
          <strong>{t('settings.webPush')}</strong>
          <p className="muted small">{t('settings.webPushHint')}</p>
        </div>
        <input type="checkbox" className="switch" checked={on} disabled={busy} onChange={(e) => void toggle(e.target.checked)} />
      </label>
      {error && <p className="error">{error}</p>}
    </>
  )
}
