import { noteName } from '@shared/feed'
import { dateKey, formatDateKey, formatTime } from '@shared/dates'
import { describeReminder, remindersProblem, repeats } from '@shared/reminders'
import type { Reminder, SaveNoteRequest } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { IoNotificationsOutline, IoRepeat } from 'react-icons/io5'
import { Link, useNavigate, useParams } from 'react-router'
import { notesApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { ReminderList } from '../components/ReminderList'
import { ChangeType } from '../components/ChangeType'
import { SourceCapture } from '../components/SourceCapture'
import { useAction } from '../lib/useAction'
import { t } from '@shared/i18n'

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
  const [reminders, setReminders] = useState<Reminder[]>([])

  if (isPending) return <div className="page"><p className="muted">{t('common.loading')}</p></div>
  if (error || !note) return <div className="page"><p className="error">{error?.message ?? t('note.notFound')}</p><Link to="/notes">{t('note.backToList')}</Link></div>

  const startEdit = () => {
    setTitle(note.title ?? '')
    setContent(note.content)
    setReminders(note.reminders)
    setEditing(true)
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    // PUT replaces the note, so the reminder is always sent (null = none).
    update.mutate({ title: title.trim() || null, content: content.trim(), reminders }, { onSuccess: () => setEditing(false) })
  }

  const reminderIssue = remindersProblem(reminders, { itemHasTime: false, isNote: true })

  const when = (utc: string) =>
    `${formatDateKey(dateKey(utc, zone.timeZone), zone.locale, { month: 'short', day: 'numeric', year: 'numeric' })}, ${formatTime(utc, zone)}`

  return (
    <div className="page detail">

      {editing ? (
        <form className="card form" onSubmit={save}>
          <h3>{t('note.edit')}</h3>
          <label>
            {t('item.title')} <span className="muted">{t('item.optional')}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            {t('kind.note')}
            <textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} required autoFocus />
          </label>
          <div className="field">
            <span>{t('item.reminder')}</span>
            <ReminderList value={reminders} onChange={setReminders} itemHasTime={false} isNote />
          </div>
          {update.error && <p className="error">{update.error.message}</p>}
          <div className="form-actions">
            <button type="button" onClick={() => setEditing(false)}>{t('common.cancel')}</button>
            <button type="submit" className="primary" disabled={!content.trim() || !!reminderIssue || update.isPending}>{t('item.saveChanges')}</button>
          </div>
        </form>
      ) : (
        <>
          <header className="detail-header">
            <span className="kind note">{t('kind.note')}</span>
            {note.title && note.title !== note.content && <h1>{note.title}</h1>}
          </header>
          <ChangeType itemType="Note" id={note.id} />
          <p className="note-body">{note.content}</p>
          {note.reminders.map((r, i) => (
            <p key={i} className="note-reminder">
              {repeats(r) ? <IoRepeat aria-hidden /> : <IoNotificationsOutline aria-hidden />} {t('note.remindMe', { reminder: describeReminder(r, zone) })}
            </p>
          ))}
          <p className="muted">
            {t('note.created', { when: when(note.createdAtUtc) })}
            {note.updatedAtUtc !== note.createdAtUtc && ` · ${t('note.edited', { when: when(note.updatedAtUtc) })}`}
          </p>
          {remove.error && <p className="error">{remove.error.message}</p>}
          <div className="detail-actions">
            <button className="primary" onClick={startEdit}>{t('common.edit')}</button>
            <button
              className="link danger"
              disabled={remove.isPending}
              onClick={() =>
                window.confirm(t('note.confirmDelete')) &&
                (setDeleting(true), remove.mutate(note.id, { onSuccess: () => navigate('/notes'), onError: () => setDeleting(false) }))
              }>
              {t('common.delete')}
            </button>
          </div>
        </>
      )}

      {note.sourceCaptureId && <SourceCapture captureId={note.sourceCaptureId} item={{ itemType: 'Note', itemId: note.id, title: noteName(note) }} />}
    </div>
  )
}
