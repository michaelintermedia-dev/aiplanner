import { formatTime } from '@shared/dates'
import { t } from '@shared/i18n'
import { searchZones, timeZoneChoices, zoneLabel } from '@shared/timeZones'
import { useMemo, useState } from 'react'
import { IoSearch } from 'react-icons/io5'
import { useAuth } from '../auth/useAuth'

const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone

/**
 * Settings - Time zone (same as the app): the account's zone with the time
 * there now, "Use this device's" when the device is somewhere else (travel),
 * and a search for any other city.
 */
export function TimeZoneSetting() {
  const { zone, changeTimeZone } = useAuth()
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const zones = useMemo(() => timeZoneChoices(zone.timeZone), [zone.timeZone])
  const results = searchZones(zones, query)

  const choose = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      await changeTimeZone(id)
      setQuery('')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card form">
      <h3>{t('settings.timeZone')}</h3>
      <p>
        <strong>{zoneLabel(zone.timeZone)}</strong>{' '}
        <span className="muted">· {t('settings.timeZoneNow', { time: formatTime(new Date().toISOString(), zone) })}</span>
      </p>
      {deviceZone && deviceZone !== zone.timeZone && (
        <button type="button" className="primary" disabled={busy} onClick={() => void choose(deviceZone)}>
          {t('settings.timeZoneDevice', { zone: zoneLabel(deviceZone) })}
        </button>
      )}
      <label className="filter-search">
        <IoSearch aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('settings.timeZoneSearch')}
          aria-label={t('settings.timeZoneSearch')}
        />
      </label>
      {results.length > 0 && (
        <div className="reminder-presets">
          {results.map((id) => (
            <button key={id} type="button" className="chip-button" disabled={busy} onClick={() => void choose(id)} title={id}>
              {zoneLabel(id)}
            </button>
          ))}
        </div>
      )}
      <p className="muted small">{t('settings.timeZoneHint')}</p>
      {error && <p className="error">{error}</p>}
    </section>
  )
}
