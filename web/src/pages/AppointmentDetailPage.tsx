import { addDays, dateKey, formatDateKey, formatTime, timeKey, zonedToUtc } from '@shared/dates'
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

  if (isPending) return <div className="page"><p className="muted">Loading…</p></div>
  if (error || !appt) return <div className="page"><p className="error">{error?.message ?? 'Appointment not found.'}</p><Link to="/calendar">Back to calendar</Link></div>

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
            <span className="kind appointment">Appointment</span>
            <h1 className={closed || passed ? 'struck' : undefined}>{appt.title}</h1>
            <div className="row-meta">
              {passed ? (
                <span className="badge status-passed">Passed</span>
              ) : (
                <span className={`badge status-${appt.status.toLowerCase()}`}>{appt.status}</span>
              )}
            </div>
          </header>
          <ChangeType itemType="Appointment" id={appt.id} />

          <dl className="facts">
            <dt>When</dt>
            <dd>
              {formatDateKey(day, zone.locale)}, {formatTime(appt.startUtc, zone)} – {formatTime(appt.endUtc, zone)}
            </dd>
            {appt.location && (
              <>
                <dt>Where</dt>
                <dd>{appt.location}</dd>
              </>
            )}
            {appt.participants.length > 0 && (
              <>
                <dt>With</dt>
                <dd>{appt.participants.map((p) => p.name).join(', ')}</dd>
              </>
            )}
            <dt>Reminder</dt>
            <dd>{appt.reminders?.length ? appt.reminders.map((r) => describeReminder(r, zone)).join(' · ') : 'None'}</dd>
          </dl>

          {appt.description && (
            <section className="text-block">
              <h2>Description</h2>
              <p>{appt.description}</p>
            </section>
          )}
          {appt.notes && (
            <section className="text-block">
              <h2>Notes</h2>
              <p>{appt.notes}</p>
            </section>
          )}

          {actionError && <p className="error">{actionError.message}</p>}
          <div className="detail-actions">
            {closed ? (
              <button className="primary" disabled={busy} onClick={() => reopen.mutate(appt.id)}>
                ↺ Reopen
              </button>
            ) : (
              <>
                <button className="primary" disabled={busy} onClick={() => complete.mutate(appt.id)}>
                  ✓ Done
                </button>
                <button disabled={busy} onClick={() => cancel.mutate(appt.id)}>
                  Cancel appointment
                </button>
              </>
            )}
            <button disabled={busy} onClick={() => setEditing(true)}>
              Edit / reschedule
            </button>
            <button
              className="link danger"
              disabled={busy}
              onClick={() =>
                window.confirm(`Delete “${appt.title}”?`) && (setDeleting(true), remove.mutate(appt.id, { onSuccess: () => navigate('/calendar'), onError: () => setDeleting(false) }))
              }>
              Delete
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
      <h3>Edit appointment</h3>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
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
      <div className="field">
        <span>Reminder</span>
        <ReminderList value={reminders} onChange={setReminders} itemHasTime />
      </div>
      <div className="form-row">
        <label>
          Location
          <input value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>
        <label>
          With <span className="muted">(comma-separated)</span>
          <input value={people} onChange={(e) => setPeople(e.target.value)} />
        </label>
      </div>
      <label>
        Description
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label>
        Notes
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {update.error && <p className="error">{update.error.message}</p>}
      <div className="form-actions">
        <button type="button" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={!title.trim() || update.isPending || !!reminderIssue}>
          Save changes
        </button>
      </div>
    </form>
  )
}
