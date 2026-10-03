import { useState, type FormEvent } from 'react'
import { appointmentsApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { addDays, todayKey, zonedToUtc, endsNextDay } from '@shared/dates'
import type { Reminder } from '@shared/types'
import { remindersProblem } from '@shared/reminders'
import { useAction } from '../lib/useAction'
import { ReminderList } from './ReminderList'
import { t } from '@shared/i18n'

export function AppointmentForm({ initialDate, onDone }: { initialDate?: string; onDone: () => void }) {
  const { zone } = useAuth()
  const create = useAction(appointmentsApi.create)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(initialDate ?? todayKey(zone.timeZone))
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [location, setLocation] = useState('')
  // Events default to a reminder 30 minutes before; change or remove it below.
  const [reminders, setReminders] = useState<Reminder[]>([{ kind: 'Before', minutesBefore: 30 }])
  const reminderIssue = remindersProblem(reminders, { itemHasTime: true, isNote: false })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (reminderIssue) return
    create.mutate(
      {
        title: title.trim(),
        startUtc: zonedToUtc(date, start, zone.timeZone),
        endUtc: zonedToUtc(endsNextDay(start, end) ? addDays(date, 1) : date, end, zone.timeZone), // after midnight: next day
        location: location.trim() || null,
        reminders,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h3>{t('event.new')}</h3>
      <label>
        {t('item.title')}
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
      </label>
      <div className="form-row">
        <label>
          {t('item.date')}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          {t('event.start')}
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
        </label>
        <label>
          {t('event.end')}
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
          {endsNextDay(start, end) && <span className="hint warn">{t('event.endsNextDay')}</span>}
        </label>
      </div>
      <div className="form-row">
        <label>
          {t('event.location')}
          <input value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>
      </div>
      <div className="field">
        <span>{t('item.reminder')}</span>
        <ReminderList value={reminders} onChange={setReminders} itemHasTime />
      </div>
      {create.error && <p className="error">{create.error.message}</p>}
      <div className="form-actions">
        <button type="button" onClick={onDone}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="primary" disabled={!title.trim() || create.isPending}>
          {t('common.save')}
        </button>
      </div>
    </form>
  )
}
