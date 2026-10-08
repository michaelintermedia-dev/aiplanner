import type { NotificationSettings } from '@shared/types'
import { LANGUAGES, languageOf, t, type Language } from '@shared/i18n'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { settingsApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { useAction } from '../lib/useAction'
import { browserNotificationsSupported, onPermissionChange, requestBrowserPermission } from '../lib/notifications'

/** Settings - Language, Notifications (spec "Settings"). Changes save immediately. */
export function SettingsPage() {
  const { zone, changeLanguage } = useAuth()
  const [languageError, setLanguageError] = useState<string | null>(null)
  const { data: settings, error } = useQuery({ queryKey: ['settings', 'notifications'], queryFn: settingsApi.notifications })
  const save = useAction(settingsApi.updateNotifications)
  const recordings = useQuery({ queryKey: ['settings', 'recordings'], queryFn: settingsApi.recordings })
  const saveRecordings = useAction(settingsApi.updateRecordings)
  const supported = browserNotificationsSupported()
  const [permission, setPermission] = useState(() => (supported ? Notification.permission : 'denied'))
  useEffect(() => onPermissionChange(() => setPermission(Notification.permission)), [])

  if (error) return <div className="page"><p className="error">{error.message}</p></div>
  if (!settings) return <div className="page"><p className="muted">{t('common.loading')}</p></div>

  const change = (patch: Partial<NotificationSettings>) => save.mutate({ ...settings, ...patch })

  return (
    <div className="page settings">
      <section className="card form">
        <h3>{t('settings.language')}</h3>
        <div className="segmented" role="radiogroup" aria-label={t('settings.language')}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="radio"
              lang={l.code}
              aria-checked={languageOf(zone.locale) === l.code}
              className={languageOf(zone.locale) === l.code ? 'active' : undefined}
              onClick={() => {
                setLanguageError(null)
                changeLanguage(l.code as Language).catch((e: Error) => setLanguageError(e.message))
              }}>
              {l.name}
            </button>
          ))}
        </div>
        <p className="muted small">{t('settings.languageHint')}</p>
        {languageError && <p className="error">{languageError}</p>}
      </section>

      <section className="card form">
        <h3>{t('settings.notifications')}</h3>

        <div className="settings-row">
          <div>
            <strong>{t('settings.thisBrowser')}</strong>
            <p className="muted small">
              {!supported
                ? t('settings.browser.unsupported')
                : permission === 'granted'
                  ? t('settings.browser.on')
                  : permission === 'denied'
                    ? t('settings.browser.blocked')
                    : t('settings.off')}
            </p>
          </div>
          {supported && permission === 'default' && (
            <button type="button" className="primary" onClick={() => void requestBrowserPermission().then(setPermission)}>
              {t('settings.turnOn')}
            </button>
          )}
        </div>

        <Toggle label={t('settings.notifications')} hint={t('settings.notificationsHint')} checked={settings.enabled} onChange={(enabled) => change({ enabled })} />
        <fieldset className="settings-group" disabled={!settings.enabled}>
          <Toggle label={t('settings.taskReminders')} checked={settings.taskReminders} onChange={(taskReminders) => change({ taskReminders })} />
          <Toggle label={t('settings.eventReminders')} checked={settings.appointmentReminders} onChange={(appointmentReminders) => change({ appointmentReminders })} />
          <Toggle
            label={t('settings.dailySummary')}
            hint={t('settings.dailySummaryHint')}
            checked={settings.dailySummary}
            onChange={(dailySummary) => change({ dailySummary })}
          />
          {settings.dailySummary && (
            <label className="settings-row">
              <span>{t('settings.dailySummaryAt')}</span>
              <input
                type="time"
                value={settings.dailySummaryTime}
                onChange={(e) => e.target.value && change({ dailySummaryTime: e.target.value })}
              />
            </label>
          )}
        </fieldset>
        {save.error && <p className="error">{save.error.message}</p>}
      </section>

      <section className="card form">
        <h3>{t('settings.recordings')}</h3>
        {recordings.data && (
          <>
            <Toggle
              label={t('settings.oneEntry')}
              hint={t('settings.oneEntryHint')}
              checked={recordings.data.oneEntryPerMessage}
              onChange={(oneEntryPerMessage) => saveRecordings.mutate({ ...recordings.data!, oneEntryPerMessage })}
            />
            <Toggle
              label={t('settings.keepRecordings')}
              hint={t('settings.keepRecordingsHint')}
              checked={recordings.data.keepRecordings}
              onChange={(keepRecordings) => saveRecordings.mutate({ ...recordings.data!, keepRecordings })}
            />
            <Toggle
              label={t('settings.shortenPauses')}
              hint={t('settings.shortenPausesHint')}
              checked={recordings.data.shortenPauses}
              onChange={(shortenPauses) => saveRecordings.mutate({ ...recordings.data!, shortenPauses })}
            />
          </>
        )}
        {(recordings.error ?? saveRecordings.error) && <p className="error">{(recordings.error ?? saveRecordings.error)!.message}</p>}
      </section>
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="settings-row">
      <div>
        <strong>{label}</strong>
        {hint && <p className="muted small">{hint}</p>}
      </div>
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}
