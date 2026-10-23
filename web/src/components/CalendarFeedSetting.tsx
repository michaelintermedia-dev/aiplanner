import { googleCalendarAddUrl, webcalUrl } from '@shared/calendarFeed'
import { t } from '@shared/i18n'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { settingsApi } from '../api/endpoints'

/**
 * Settings - Calendar - "Show in your phone's calendar" (same as the app): a
 * private link Google / Apple / Outlook calendars subscribe to, read-only.
 */
export function CalendarFeedSetting() {
  const queryClient = useQueryClient()
  const feed = useQuery({ queryKey: ['settings', 'calendar-feed'], queryFn: settingsApi.calendarFeed })
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const url = feed.data?.url ?? null

  const run = async (action: () => Promise<{ url: string | null } | void>) => {
    setBusy(true)
    setError(null)
    try {
      const result = await action()
      queryClient.setQueryData(['settings', 'calendar-feed'], result ?? { url: null })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setBusy(false)
    }
  }
  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt(t('settings.feed.copy'), url)
    }
  }

  return (
    <div className="calendar-feed">
      <strong>{t('settings.feed.title')}</strong>
      <p className="muted small">{t('settings.feed.hint')}</p>
      {!url ? (
        <button type="button" className="primary" disabled={busy || feed.isPending} onClick={() => void run(settingsApi.newCalendarFeed)}>
          {t('settings.feed.create')}
        </button>
      ) : (
        <>
          <div className="reminder-presets">
            <a className="button primary" href={googleCalendarAddUrl(url)} target="_blank" rel="noreferrer">
              {t('settings.feed.google')}
            </a>
            <a className="button" href={webcalUrl(url)}>
              {t('settings.feed.apple')}
            </a>
            <button type="button" onClick={() => void copy()}>
              {copied ? t('settings.feed.copied') : t('settings.feed.copy')}
            </button>
          </div>
          <p className="muted small">{t('settings.feed.private')}</p>
          <div className="reminder-presets">
            <button type="button" className="link" disabled={busy} onClick={() => void run(settingsApi.newCalendarFeed)}>
              {t('settings.feed.new')}
            </button>
            <button type="button" className="link danger" disabled={busy} onClick={() => void run(settingsApi.turnOffCalendarFeed)}>
              {t('settings.feed.off')}
            </button>
          </div>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
