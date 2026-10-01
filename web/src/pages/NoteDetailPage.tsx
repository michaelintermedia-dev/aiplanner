import { dateKey, formatDateKey, formatTime, timeKey, zonedToUtc } from '@shared/dates'
import type { SaveNoteRequest } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { IoNotificationsOutline } from 'react-icons/io5'
import { Link, useNavigate, useParams } from 'react-router'
import { notesApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { SourceCapture } from '../components/SourceCapture'
import { useAction } from '../lib/useAction'

export function NoteDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { zone } = useAuth()
  const [editing, setEditing] = useState(false)
  // Once a delete starts, stop (re)fetching this item - it's about to 404.
  const [deleting, setDeleting] = useState(false)
  const { data: note, isPending, error } = useQuery({ queryKey: ['note', id], queryFn: () => notesApi.get(id), enabled: !deleting })
  const update = useAction((body: SaveNoteRequest) => notesApi.update(id, body))
  const remove = useAction(notesApi.remove, { forget: (noteId) => ['note', noteId] })
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [remindDate, setRemindDate] = useState('')
  const [remindTime, setRemindTime] = useState('')

  if (isPending) return <div className="page"><p className="muted">Loading…</p></div>
  if (error || !note) return <div className="page"><p className="error">{error?.message ?? 'Note not found.'}</p><Link to="/notes">Back to notes</Link></div>

  const startEdit = () => {
    setTitle(note.title ?? '')
    setContent(note.content)
    setRemindDate(note.reminderAtUtc ? dateKey(note.reminderAtUtc, zone.timeZone) : '')
    setRemindTime(note.reminderAtUtc ? timeKey(note.reminderAtUtc, zone.timeZone) : '')
    setEditing(true)
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    // PUT replaces the note, so the reminder is always sent (null = none).
    const reminderAtUtc = remindDate && remindTime ? zonedToUtc(remindDate, remindTime, zone.timeZone) : null
    update.mutate({ title: title.trim() || null, content: content.trim(), reminderAtUtc }, { onSuccess: () => setEditing(false) })
  }

  const halfReminder = !!remindDate !== !!remindTime

  const when = (utc: string) =>
    `${formatDateKey(dateKey(utc, zone.timeZone), zone.locale, { month: 'short', day: 'numeric', year: 'numeric' })}, ${formatTime(utc, zone)}`

  return (
    <div className="page detail">

      {editing ? (
        <form className="card form" onSubmit={save}>
          <h3>Edit note</h3>
          <label>
            Title <span className="muted">(optional)</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Note
            <textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} required autoFocus />
          </label>
          <div className="review-fields">
            <label>
              Remind me on <span className="muted">(optional)</span>
              <input type="date" value={remindDate} onChange={(e) => setRemindDate(e.target.value)} />
            </label>
            <label>
              At
              <input type="time" value={remindTime} onChange={(e) => setRemindTime(e.target.value)} />
            </label>
          </div>
          {halfReminder && <p className="error">Pick both a date and a time for the reminder, or clear both.</p>}
          {update.error && <p className="error">{update.error.message}</p>}
          <div className="form-actions">
            <button type="button" onClick={() => setEditing(false)}>Cancel</button>
            <button type="submit" className="primary" disabled={!content.trim() || halfReminder || update.isPending}>Save changes</button>
          </div>
        </form>
      ) : (
        <>
          <header className="detail-header">
            <span className="kind note">Note</span>
            {note.title && note.title !== note.content && <h1>{note.title}</h1>}
          </header>
          <p className="note-body">{note.content}</p>
          {note.reminderAtUtc && (
            <p className="note-reminder">
              <IoNotificationsOutline aria-hidden /> Remind me {when(note.reminderAtUtc)}
            </p>
          )}
          <p className="muted">
            Created {when(note.createdAtUtc)}
            {note.updatedAtUtc !== note.createdAtUtc && ` · edited ${when(note.updatedAtUtc)}`}
          </p>
          {remove.error && <p className="error">{remove.error.message}</p>}
          <div className="detail-actions">
            <button className="primary" onClick={startEdit}>Edit</button>
            <button
              className="link danger"
              disabled={remove.isPending}
              onClick={() =>
                window.confirm('Delete this note?') &&
                (setDeleting(true), remove.mutate(note.id, { onSuccess: () => navigate('/notes'), onError: () => setDeleting(false) }))
              }>
              Delete
            </button>
          </div>
        </>
      )}

      {note.sourceCaptureId && <SourceCapture captureId={note.sourceCaptureId} />}
    </div>
  )
}
