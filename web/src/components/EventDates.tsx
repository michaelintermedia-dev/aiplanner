import { useNow } from '../lib/useNow'
import { formatDateKey, formatTime, dateKey } from '@shared/dates'
import { t } from '@shared/i18n'
import { occurrences } from '@shared/recurrence'
import type { Appointment } from '@shared/types'
import { useSearchParams } from 'react-router'
import { appointmentsApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { useAction } from '../lib/useAction'

/**
 * A repeating event's next dates, each with Skip ("not this week"), and the
 * skipped ones still ahead with Bring back. Opened from a calendar entry
 * (?at=...), that date is marked.
 */
export function EventDates({ appt }: { appt: Appointment }) {
  const { zone } = useAuth()
  const [params] = useSearchParams()
  const at = params.get('at')
  const skip = useAction((start: string) => appointmentsApi.skip(appt.id, start))
  const unskip = useAction((start: string) => appointmentsApi.unskip(appt.id, start))
  const now = useNow().getTime()
  if (!appt.recurrence) return null

  const length = Date.parse(appt.endUtc) - Date.parse(appt.startUtc)
  const fromUtc = new Date(now - length).toISOString() // still going counts
  const skipped = (appt.skippedUtc ?? []).filter((s) => Date.parse(s) + length > now)
  const next = occurrences(appt.recurrence, appt.startUtc, zone.timeZone, { fromUtc, max: 4, skipped: appt.skippedUtc ?? [] })
  const when = (start: string) =>
    `${formatDateKey(dateKey(start, zone.timeZone), zone.locale, { weekday: 'short', month: 'short', day: 'numeric' })}, ${formatTime(start, zone)}`
  const busy = skip.isPending || unskip.isPending

  return (
    <section className="event-dates" aria-label={t('repeat.nextDates')}>
      <h2>{t('repeat.nextDates')}</h2>
      <ul>
        {next.map((start) => (
          <li key={start} className={at && Date.parse(at) === Date.parse(start) ? 'this-date' : undefined}>
            <span>{when(start)}</span>
            <button type="button" className="link" disabled={busy} onClick={() => skip.mutate(start)}>
              {t('repeat.skip')}
            </button>
          </li>
        ))}
        {skipped.map((start) => (
          <li key={`s${start}`} className="skipped">
            <span>
              <s>{when(start)}</s> · {t('repeat.skipped')}
            </span>
            <button type="button" className="link" disabled={busy} onClick={() => unskip.mutate(start)}>
              {t('repeat.bringBack')}
            </button>
          </li>
        ))}
      </ul>
      {(skip.error ?? unskip.error) && <p className="error">{(skip.error ?? unskip.error)!.message}</p>}
    </section>
  )
}
