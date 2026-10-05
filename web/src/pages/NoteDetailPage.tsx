import { noteName } from '@shared/feed'
import { dateKey, formatDateKey, formatTime } from '@shared/dates'
import { formFromNote } from '@shared/itemForm'
import { describeReminder, repeats } from '@shared/reminders'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { IoNotificationsOutline, IoRepeat } from 'react-icons/io5'
import { Link, useNavigate, useParams } from 'react-router'
import { notesApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { DraftNotice, EditButtons, FollowUpReview, useEditMode } from '../components/ItemEditMode'
import { hasEditDraft, ItemEditor } from '../components/ItemEditor'
import { SourceCapture } from '../components/SourceCapture'
import { useAction } from '../lib/useAction'
import { t } from '@shared/i18n'

export function NoteDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { zone } = useAuth()
  // Everything that changes the note happens in Edit (?edit=1 / ?talk=1 open it).
  const edit = useEditMode()
  // Once a delete starts, stop (re)fetching this item - it's about to 404.
  const [deleting, setDeleting] = useState(false)
  const { data: note, isPending, error } = useQuery({ queryKey: ['note', id], queryFn: () => notesApi.get(id), enabled: !deleting })
  const remove = useAction(notesApi.remove, { forget: (noteId) => ['note', noteId] })

  if (isPending) return <div className="page"><p className="muted">{t('common.loading')}</p></div>
  if (error || !note) return <div className="page"><p className="error">{error?.message ?? t('note.notFound')}</p><Link to="/notes">{t('note.backToList')}</Link></div>

  const when = (utc: string) =>
    `${formatDateKey(dateKey(utc, zone.timeZone), zone.locale, { month: 'short', day: 'numeric', year: 'numeric' })}, ${formatTime(utc, zone)}`

  return (
    <div className="page detail">

      {edit.followUp && <FollowUpReview text={edit.followUp} onDone={edit.clearFollowUp} />}
      <DraftNotice show={!edit.mode && hasEditDraft(note.id, formFromNote(note))} onContinue={edit.edit} />
      {edit.mode ? (
        <ItemEditor
          item={{ itemType: 'Note', id: note.id, title: noteName(note) }}
          saved={formFromNote(note)}
          captureId={note.sourceCaptureId}
          talk={edit.mode === 'talk'}
          onDone={edit.done}
        />
      ) : (
        <>
          <header className="detail-header">
            <span className="kind note">{t('kind.note')}</span>
            {note.title && note.title !== note.content && <h1>{note.title}</h1>}
          </header>
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
            <EditButtons onEdit={edit.edit} onTalk={edit.talk} />
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

      {!edit.mode && note.sourceCaptureId && <SourceCapture captureId={note.sourceCaptureId} item={{ itemType: 'Note', itemId: note.id, title: noteName(note) }} />}
    </div>
  )
}
