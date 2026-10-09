import { useNow } from '../lib/useNow'
import { EventDates } from '../components/EventDates'
import { IoRepeat } from 'react-icons/io5'
import { describeRecurrence, occurrences } from '@shared/recurrence'
import { dateKey, formatDateKey, formatTime } from '@shared/dates'
import { eventPassed } from '@shared/feed'
import { formFromAppointment } from '@shared/itemForm'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { appointmentsApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { DraftNotice, EditButtons, FollowUpReview, useEditMode } from '../components/ItemEditMode'
import { hasEditDraft, ItemEditor } from '../components/ItemEditor'
import { ItemMedia } from '../components/ItemMedia'
import { SourceCapture } from '../components/SourceCapture'
import { describeReminder } from '@shared/reminders'
import { useAction } from '../lib/useAction'
import { t } from '@shared/i18n'
import { priorityLabel, statusLabel } from '@shared/labels'

export function AppointmentDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { zone } = useAuth()
  // Everything that changes the event happens in Edit (?edit=1 / ?talk=1 open it).
  const edit = useEditMode()
  // Once a delete starts, stop (re)fetching this item - it's about to 404.
  const [deleting, setDeleting] = useState(false)
  const { data: appt, isPending, error } = useQuery({ queryKey: ['appointment', id], queryFn: () => appointmentsApi.get(id), enabled: !deleting })

  const complete = useAction(appointmentsApi.complete)
  const cancel = useAction(appointmentsApi.cancel)
  const reopen = useAction(appointmentsApi.reopen)
  const remove = useAction(appointmentsApi.remove, { forget: (apptId) => ['appointment', apptId] })
  const now = useNow().getTime()
  const busy = complete.isPending || cancel.isPending || reopen.isPending || remove.isPending
  const actionError = complete.error ?? cancel.error ?? reopen.error ?? remove.error

  if (isPending) return <div className="page"><p className="muted">{t('common.loading')}</p></div>
  if (error || !appt) return <div className="page"><p className="error">{error?.message ?? t('event.notFound')}</p><Link to="/calendar">{t('event.backToCalendar')}</Link></div>

  const closed = appt.status !== 'Scheduled'
  // A repeating event: shown at its next date; "passed" once the whole series is over.
  const next = appt.recurrence
    ? occurrences(appt.recurrence, appt.startUtc, zone.timeZone, {
        fromUtc: new Date(now - (Date.parse(appt.endUtc) - Date.parse(appt.startUtc))).toISOString(),
        max: 1,
        skipped: appt.skippedUtc ?? [],
      })[0]
    : undefined
  const shownStart = next ?? appt.startUtc
  const shownEnd = next ? new Date(Date.parse(next) + Date.parse(appt.endUtc) - Date.parse(appt.startUtc)).toISOString() : appt.endUtc
  const passed = appt.recurrence ? !next : eventPassed(appt)
  const day = dateKey(shownStart, zone.timeZone)

  return (
    <div className="page detail">

      {edit.followUp && <FollowUpReview text={edit.followUp} onDone={edit.clearFollowUp} />}
      <DraftNotice show={!edit.mode && hasEditDraft(appt.id, formFromAppointment(appt, zone.timeZone))} onContinue={edit.edit} />
      {edit.mode ? (
        <ItemEditor
          item={{ itemType: 'Appointment', id: appt.id, title: appt.title }}
          saved={formFromAppointment(appt, zone.timeZone)}
          captureId={appt.sourceCaptureId ?? null}
          talk={edit.mode === 'talk'}
          onDone={edit.done}
        />
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
              {appt.priority && appt.priority !== 'None' && (
                <span className={`badge prio-${appt.priority.toLowerCase()}`}>{t('task.priorityBadge', { priority: priorityLabel(appt.priority) })}</span>
              )}
              {appt.tags?.map((tag) => (
                <span key={tag} className="tag">#{tag}</span>
              ))}
            </div>
          </header>

          <dl className="facts">
            <dt>{t('event.when')}</dt>
            <dd>
              {formatDateKey(day, zone.locale)}, {formatTime(shownStart, zone)} – {formatTime(shownEnd, zone)}
            </dd>
            {appt.recurrence && (
              <>
                <dt>{t('repeat.repeats')}</dt>
                <dd>
                  <IoRepeat className="repeat-icon" aria-hidden /> {describeRecurrence(appt.recurrence, zone)}
                </dd>
              </>
            )}
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

          {!closed && <EventDates appt={appt} />}

          {actionError && <p className="error">{actionError.message}</p>}
          <div className="detail-actions">
            {closed ? (
              <button className="primary" disabled={busy} onClick={() => reopen.mutate(appt.id)}>
                ↺ {t('item.reopen')}
              </button>
            ) : (
              <>
                {/* Each date of a repeating event passes on its own - no Done for the series. */}
                {!appt.recurrence && (
                  <button className="primary" disabled={busy} onClick={() => complete.mutate(appt.id)}>
                    ✓ {t('common.done')}
                  </button>
                )}
                <button disabled={busy} onClick={() => cancel.mutate(appt.id)}>
                  {t('event.cancel')}
                </button>
              </>
            )}
            <EditButtons onEdit={edit.edit} onTalk={edit.talk} disabled={busy} />
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

      {!edit.mode && <ItemMedia itemType="Appointment" id={appt.id} />}

      {!edit.mode && appt.sourceCaptureId && <SourceCapture captureId={appt.sourceCaptureId} />}
    </div>
  )
}
