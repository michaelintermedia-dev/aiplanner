import type { NotificationSettings } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { settingsApi } from '../api/endpoints'
import { useAction } from '../lib/useAction'
import { browserNotificationsSupported, onPermissionChange, requestBrowserPermission } from '../lib/notifications'

/** Settings - Notifications (spec "Settings"). Changes save immediately. */
export function SettingsPage() {
  const { data: settings, error } = useQuery({ queryKey: ['settings', 'notifications'], queryFn: settingsApi.notifications })
  const save = useAction(settingsApi.updateNotifications)
  const supported = browserNotificationsSupported()
  const [permission, setPermission] = useState(() => (supported ? Notification.permission : 'denied'))
  useEffect(() => onPermissionChange(() => setPermission(Notification.permission)), [])

  if (error) return <div className="page"><p className="error">{error.message}</p></div>
  if (!settings) return <div className="page"><p className="muted">Loading…</p></div>

  const change = (patch: Partial<NotificationSettings>) => save.mutate({ ...settings, ...patch })

  return (
    <div className="page settings">
      <section className="card form">
        <h3>Notifications</h3>

        <div className="settings-row">
          <div>
            <strong>This browser</strong>
            <p className="muted small">
              {!supported
                ? 'This browser can’t show notifications.'
                : permission === 'granted'
                  ? 'On - notifications show while the app is open in a tab.'
                  : permission === 'denied'
                    ? 'Blocked - allow notifications for this site in the browser’s settings.'
                    : 'Off'}
            </p>
          </div>
          {supported && permission === 'default' && (
            <button type="button" className="primary" onClick={() => void requestBrowserPermission().then(setPermission)}>
              Turn on
            </button>
          )}
        </div>

        <Toggle label="Notifications" hint="Master switch for all devices" checked={settings.enabled} onChange={(enabled) => change({ enabled })} />
        <fieldset className="settings-group" disabled={!settings.enabled}>
          <Toggle label="Task reminders" checked={settings.taskReminders} onChange={(taskReminders) => change({ taskReminders })} />
          <Toggle label="Event reminders" checked={settings.appointmentReminders} onChange={(appointmentReminders) => change({ appointmentReminders })} />
          <Toggle
            label="Daily summary"
            hint="What's due today, what's overdue, and today's events"
            checked={settings.dailySummary}
            onChange={(dailySummary) => change({ dailySummary })}
          />
          {settings.dailySummary && (
            <label className="settings-row">
              <span>Daily summary at</span>
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
