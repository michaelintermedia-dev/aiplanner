import { useState, type FormEvent } from 'react'
import { appointmentsApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { todayKey, zonedToUtc } from '../lib/dates'
import { useAction } from '../lib/useAction'

const REMINDER_OPTIONS = [
  { label: 'No reminder', value: '' },
  { label: '10 minutes before', value: '10' },
  { label: '30 minutes before', value: '30' },
  { label: '1 hour before', value: '60' },
  { label: '1 day before', value: '1440' },
]

export function AppointmentForm({ initialDate, onDone }: { initialDate?: string; onDone: () => void }) {
  const { zone } = useAuth()
  const create = useAction(appointmentsApi.create)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(initialDate ?? todayKey(zone.timeZone))
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [location, setLocation] = useState('')
  const [reminder, setReminder] = useState('30')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate(
      {
        title: title.trim(),
        startUtc: zonedToUtc(date, start, zone.timeZone),
        endUtc: zonedToUtc(date, end, zone.timeZone),
        location: location.trim() || null,
        reminderMinutesBeforeStart: reminder ? Number(reminder) : null,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h3>New appointment</h3>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
      </label>
      <div className="form-row">
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Start
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
        </label>
        <label>
          End
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </label>
      </div>
      <div className="form-row">
        <label>
          Location
          <input value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>
        <label>
          Reminder
          <select value={reminder} onChange={(e) => setReminder(e.target.value)}>
            {REMINDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {create.error && <p className="error">{create.error.message}</p>}
      <div className="form-actions">
        <button type="button" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={!title.trim() || create.isPending}>
          Save
        </button>
      </div>
    </form>
  )
}
