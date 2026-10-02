import { Link } from 'react-router'
import { appointmentsApi } from '../api/endpoints'
import type { Appointment } from '@shared/types'
import { useAuth } from '../auth/useAuth'
import { formatTime } from '@shared/dates'
import { eventPassed } from '@shared/feed'
import { useAction } from '../lib/useAction'

export function AppointmentRow({ appointment: a }: { appointment: Appointment }) {
  const { zone } = useAuth()
  const complete = useAction(appointmentsApi.complete)
  const cancel = useAction(appointmentsApi.cancel)
  const busy = complete.isPending || cancel.isPending
  const done = a.status !== 'Scheduled'
  const passed = eventPassed(a)

  return (
    <li className={`row appointment${done ? ' done' : ''}${passed ? ' passed' : ''}`}>
      <span className="time-range">
        {formatTime(a.startUtc, zone)}
        <small>{formatTime(a.endUtc, zone)}</small>
      </span>
      <div className="row-main">
        <Link className="row-title" to={`/appointments/${a.id}`}>{a.title}</Link>
        <span className="row-meta">
          {a.location && <span>{a.location}</span>}
          {done && <span className="badge">{a.status}</span>}
          {passed && <span className="badge status-passed">Passed</span>}
        </span>
      </div>
      {!done && (
        <div className="row-actions">
          <button className="link" disabled={busy} onClick={() => complete.mutate(a.id)}>
            Done
          </button>
          <button className="link danger" disabled={busy} onClick={() => cancel.mutate(a.id)}>
            Cancel
          </button>
        </div>
      )}
    </li>
  )
}
