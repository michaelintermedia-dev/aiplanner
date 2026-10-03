import { addDays, dateKey, formatDateKey, formatTime, timeKey, zonedToUtc, endsNextDay } from '@shared/dates'
import { eventPassed } from '@shared/feed'
import type { Appointment, Reminder } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { appointmentsApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { ReminderList } from '../components/ReminderList'
import { ChangeType } from '../components/ChangeType'
import { SourceCapture } from '../components/SourceCapture'
import { describeReminder, remindersProblem } from '@shared/reminders'
import { useAction } from '../lib/useAction'
import { t } from '@shared/i18n'
import { statusLabel } from '@shared/labels'

export function AppointmentDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { zone } = useAuth()
  // ?edit=1: just converted and something was guessed - start in the edit form.
  const [editing, setEditing] = useState(useSearchParams()[0].get('edit') === '1')
  // Once a delete starts, stop (re)fetching this item - it's about to 404.
  const [deleting, setDeleting] = useState(false)
  const { data: appt, isPending, error } = useQuery({ queryKey: ['appointment', id], queryFn: () => appointmentsApi.get(id), enabled: !deleting })

  const complete = useAction(appointmentsApi.complete)
  const cancel = useAction(appointmentsApi.cancel)
  const reopen = useAction(appointmentsApi.reopen)
  const remove = useAction(appointmentsApi.remove, { forget: (apptId) => ['appointment', apptId] })
  const busy = complete.isPending || cancel.isPending || reopen.isPending || remove.isPending
  const actionError = complete.error ?? cancel.error ?? reopen.error ?? remove.error

  if (isPending) return <div className="page"><p className="muted">{t('common.loading')}</p></div>
  if (error || !appt) return <div className="page"><p className="error">{error?.message ?? t('event.notFound')}</p><Link to="/calendar">{t('event.backToCalendar')}</Link></div>

  const closed = appt.status !== 'Scheduled'
  const passed = eventPassed(appt)
  const day = dateKey(appt.startUtc, zone.timeZone)

  return (
    <div className="page detail">

      {editing ? (
        <AppointmentEditForm appt={appt} onDone={() => setEditing(false)} />
      ) : (
        <>
          <header className="detail-header">
            <span className="kind appointment">{t('kind.event')}</span>
            <h1 className={closed || passed ? 'struck' : undefined}>{appt.title}</h1>
            <div className="row-meta">
              {passed ? (
                <span className="badge status-passed">{t('status.passed')}</span>
              ) : (
                <span className={`badge status-${appt.status.toLowerCase()}`}>{statusLabel(appt.status)}</span>
              )}
            </div>
          </header>
          <ChangeType itemType="Appointment" id={appt.id} />

          <dl className="facts">
            <dt>{t('event.when')}</dt>
            <dd>
              {formatDateKey(day, zone.locale)}, {formatTime(appt.startUtc, zone)} – {formatTime(appt.endUtc, zone)}
            </dd>
            {appt.location && (
              <>
                <dt>{t('event.where')}</dt>
                <dd>{appt.location}</dd>
              </>
            )}
            {appt.participants.length > 0 && (
              <>
                <dt>{t('event.with')}</dt>
                <dd>{appt.participants.map((p) => p.name).join(', ')}</dd>
              </>
            )}
            <dt>{t('item.reminder')}</dt>
            <dd>{appt.reminders?.length ? appt.reminders.map((r) => describeReminder(r, zone)).join(' · ') : t('item.none')}</dd>
          </dl>

          {appt.description && (
            <section className="text-block">
              <h2>{t('item.description')}</h2>
              <p>{appt.description}</p>
            </section>
          )}
          {appt.notes && (
            <section className="text-block">
              <h2>{t('item.notes')}</h2>
              <p>{appt.notes}</p>
            </section>
          )}

          {actionError && <p className="error">{actionError.message}</p>}
          <div className="detail-actions">
            {closed ? (
              <button className="primary" disabled={busy} onClick={() => reopen.mutate(appt.id)}>
                ↺ {t('item.reopen')}
              </button>
            ) : (
              <>
                <button className="primary" disabled={busy} onClick={() => complete.mutate(appt.id)}>
                  ✓ {t('common.done')}
                </button>
                <button disabled={busy} onClick={() => cancel.mutate(appt.id)}>
                  {t('event.cancel')}
                </button>
              </>
            )}
            <button disabled={busy} onClick={() => setEditing(true)}>
              {t('event.editReschedule')}
            </button>
            <button
              className="link danger"
              disabled={busy}
              onClick={() =>
                window.confirm(t('item.confirmDelete', { title: appt.title })) && (setDeleting(true), remove.mutate(appt.id, { onSuccess: () => navigate('/calendar'), onError: () => setDeleting(false) }))
              }>
              {t('common.delete')}
            </button>
          </div>
        </>
      )}

      {appt.sourceCaptureId && <SourceCapture captureId={appt.sourceCaptureId} item={{ itemType: 'Appointment', itemId: appt.id, title: appt.title }} />}
    </div>
  )
}

function AppointmentEditForm({ appt, onDone }: { appt: Appointment; onDone: () => void }) {
  const { zone } = useAuth()
  const update = useAction((body: Parameters<typeof appointmentsApi.update>[1]) => appointmentsApi.update(appt.id, body))
  const [title, setTitle] = useState(appt.title)
  const [date, setDate] = useState(dateKey(appt.startUtc, zone.timeZone))
  const [start, setStart] = useState(timeKey(appt.startUtc, zone.timeZone))
  const [end, setEnd] = useState(timeKey(appt.endUtc, zone.timeZone))
  const [location, setLocation] = useState(appt.location ?? '')
  const [people, setPeople] = useState(appt.participants.map((p) => p.name).join(', '))
  const [reminders, setReminders] = useState<Reminder[]>(appt.reminders ?? [])
  const reminderIssue = remindersProblem(reminders, { itemHasTime: true, isNote: false })
  const [description, setDescription] = useState(appt.description ?? '')
  const [notes, setNotes] = useState(appt.notes ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (reminderIssue) return
    const startUtc = zonedToUtc(date, start, zone.timeZone)
    let endUtc = zonedToUtc(date, end, zone.timeZone)
    if (endUtc <= startUtc) endUtc = zonedToUtc(addDays(date, 1), end, zone.timeZone) // ends after midnight
    update.mutate(
      {
        title: title.trim(),
        description: description.trim() || null,
        notes: notes.trim() || null,
        startUtc,
        endUtc,
        location: location.trim() || null,
        participantNames: people.split(',').map((p) => p.trim()).filter(Boolean),
        reminders,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h3>{t('event.edit')}</h3>
      <label>
        {t('item.title')}
        <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
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
      <div className="field">
        <span>{t('item.reminder')}</span>
        <ReminderList value={reminders} onChange={setReminders} itemHasTime />
      </div>
      <div className="form-row">
        <label>
          {t('event.location')}
          <input value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>
        <label>
          {t('event.with')} <span className="muted">{t('item.commaSeparated')}</span>
          <input value={people} onChange={(e) => setPeople(e.target.value)} />
        </label>
      </div>
      <label>
        {t('item.description')}
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label>
        {t('item.notes')}
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {update.error && <p className="error">{update.error.message}</p>}
      <div className="form-actions">
        <button type="button" onClick={onDone}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="primary" disabled={!title.trim() || update.isPending || !!reminderIssue}>
          {t('item.saveChanges')}
        </button>
      </div>
    </form>
  )
}
