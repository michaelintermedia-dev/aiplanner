import { dateKey, formatDateKey, formatDue, formatTime } from '@shared/dates'
import { formFromTask } from '@shared/itemForm'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { tasksApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { EditButtons, FollowUpReview, useEditMode } from '../components/ItemEditMode'
import { ItemEditor } from '../components/ItemEditor'
import { SourceCapture } from '../components/SourceCapture'
import { describeReminder } from '@shared/reminders'
import { useAction } from '../lib/useAction'
import { t } from '@shared/i18n'
import { priorityLabel, statusLabel } from '@shared/labels'

export function TaskDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { zone } = useAuth()
  // Everything that changes the task happens in Edit (?edit=1 / ?talk=1 open it).
  const edit = useEditMode()
  // Once a delete starts, stop (re)fetching this item - it's about to 404.
  const [deleting, setDeleting] = useState(false)
  const { data: task, isPending, error } = useQuery({ queryKey: ['task', id], queryFn: () => tasksApi.get(id), enabled: !deleting })

  const complete = useAction(tasksApi.complete)
  const cancel = useAction(tasksApi.cancel)
  const reopen = useAction(tasksApi.reopen)
  const remove = useAction(tasksApi.remove, { forget: (taskId) => ['task', taskId] })
  const busy = complete.isPending || cancel.isPending || reopen.isPending || remove.isPending
  const actionError = complete.error ?? cancel.error ?? reopen.error ?? remove.error

  if (isPending) return <div className="page"><p className="muted">{t('common.loading')}</p></div>
  if (error || !task) return <div className="page"><p className="error">{error?.message ?? t('task.notFound')}</p><Link to="/tasks">{t('task.backToList')}</Link></div>

  const closed = task.status === 'Completed' || task.status === 'Cancelled'

  return (
    <div className="page detail">

      {edit.followUp && <FollowUpReview text={edit.followUp} onDone={edit.clearFollowUp} />}
      {edit.mode ? (
        <ItemEditor
          item={{ itemType: 'Task', id: task.id, title: task.title }}
          saved={formFromTask(task, zone.timeZone)}
          captureId={task.sourceCaptureId ?? null}
          talk={edit.mode === 'talk'}
          onDone={edit.done}
        />
      ) : (
        <>
          <header className="detail-header">
            <span className="kind task">{t('kind.task')}</span>
            <h1 className={closed ? 'struck' : undefined}>{task.title}</h1>
            <div className="row-meta">
              <span className={`badge status-${task.status.toLowerCase()}`}>{statusLabel(task.status)}</span>
              {task.priority !== 'None' && <span className={`badge prio-${task.priority.toLowerCase()}`}>{t('task.priorityBadge', { priority: priorityLabel(task.priority) })}</span>}
              {task.tags.map((tag) => (
                <span key={tag} className="tag">#{tag}</span>
              ))}
            </div>
          </header>

          <dl className="facts">
            <dt>{t('task.due')}</dt>
            <dd>{task.dueDateUtc ? formatDue(task.dueDateUtc, task.hasDueTime, zone) : task.status === 'Ongoing' ? t('task.ongoingNoDeadline') : t('task.noDueDate')}</dd>
            <dt>{t('item.reminder')}</dt>
            <dd>{task.reminders?.length ? task.reminders.map((r) => describeReminder(r, zone)).join(' · ') : t('item.none')}</dd>
            {task.completedAtUtc && (
              <>
                <dt>{t('status.Completed')}</dt>
                <dd>{formatDue(task.completedAtUtc, true, zone)}</dd>
              </>
            )}
            <dt>{t('filter.created')}</dt>
            <dd>
              {formatDateKey(dateKey(task.createdAtUtc, zone.timeZone), zone.locale, { month: 'short', day: 'numeric', year: 'numeric' })}, {formatTime(task.createdAtUtc, zone)}
            </dd>
          </dl>

          {task.description && <TextBlock title={t('item.description')} text={task.description} />}
          {task.notes && <TextBlock title={t('item.notes')} text={task.notes} />}
          {task.aiSummary && <TextBlock title={t('item.aiSummary')} text={task.aiSummary} />}

          {actionError && <p className="error">{actionError.message}</p>}
          <div className="detail-actions">
            {closed ? (
              <button className="primary" disabled={busy} onClick={() => reopen.mutate(task.id)}>
                ↺ {t('item.reopen')}
              </button>
            ) : (
              <>
                <button className="primary" disabled={busy} onClick={() => complete.mutate(task.id)}>
                  ✓ {t('task.complete')}
                </button>
                <button disabled={busy} onClick={() => cancel.mutate(task.id)}>
                  {t('task.cancel')}
                </button>
              </>
            )}
            <EditButtons onEdit={edit.edit} onTalk={edit.talk} disabled={busy} />
            <button
              className="link danger"
              disabled={busy}
              onClick={() =>
                window.confirm(t('item.confirmDelete', { title: task.title })) && (setDeleting(true), remove.mutate(task.id, { onSuccess: () => navigate('/tasks'), onError: () => setDeleting(false) }))
              }>
              {t('common.delete')}
            </button>
          </div>
        </>
      )}

      {!edit.mode && task.sourceCaptureId && <SourceCapture captureId={task.sourceCaptureId} item={{ itemType: 'Task', itemId: task.id, title: task.title }} />}
    </div>
  )
}

function TextBlock({ title, text }: { title: string; text: string }) {
  return (
    <section className="text-block">
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  )
}
