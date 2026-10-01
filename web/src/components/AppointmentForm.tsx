import { useState, type FormEvent } from 'react'
import { appointmentsApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { todayKey, zonedToUtc } from '@shared/dates'
import type { Reminder } from '@shared/types'
import { reminderProblem } from '@shared/reminders'
import { useAction } from '../lib/useAction'
import { ReminderPicker } from './ReminderPicker'

export function AppointmentForm({ initialDate, onDone }: { initialDate?: string; onDone: () => void }) {
  const { zone } = useAuth()
  const create = useAction(appointmentsApi.create)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(initialDate ?? todayKey(zone.timeZone))
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [location, setLocation] = useState('')
  // Events default to a reminder 30 minutes before; change or remove it below.
  const [reminder, setReminder] = useState<Reminder | null>({ kind: 'Before', minutesBefore: 30 })
  const reminderIssue = reminderProblem(reminder, { itemHasTime: true, isNote: false })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (reminderIssue) return
    create.mutate(
      {
        title: title.trim(),
        startUtc: zonedToUtc(date, start, zone.timeZone),
        endUtc: zonedToUtc(date, end, zone.timeZone),
        location: location.trim() || null,
        reminder,
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
      </div>
      <div className="field">
        <span>Reminder</span>
        <ReminderPicker value={reminder} onChange={setReminder} itemHasTime />
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
