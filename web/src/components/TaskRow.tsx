import { Link } from 'react-router'
import { tasksApi } from '../api/endpoints'
import type { Task } from '@shared/types'
import { useAuth } from '../auth/useAuth'
import { formatDue, todayKey, dateKey } from '@shared/dates'
import { useAction } from '../lib/useAction'
import { t } from '@shared/i18n'
import { priorityLabel, statusLabel } from '@shared/labels'

export function TaskRow({ task }: { task: Task }) {
  const { zone } = useAuth()
  const complete = useAction(tasksApi.complete)
  const reopen = useAction(tasksApi.reopen)
  const cancel = useAction(tasksApi.cancel)
  const remove = useAction(tasksApi.remove)

  const done = task.status === 'Completed' || task.status === 'Cancelled'
  const busy = complete.isPending || reopen.isPending || cancel.isPending || remove.isPending
  const overdue =
    !done && task.dueDateUtc !== null && dateKey(task.dueDateUtc, zone.timeZone) < todayKey(zone.timeZone)

  return (
    <li className={`row task${done ? ' done' : ''}`}>
      <button
        className={`check${task.status === 'Completed' ? ' checked' : ''}`}
        aria-label={task.status === 'Completed' ? t('task.markNotDone') : t('task.markDone')}
        disabled={busy || task.status === 'Cancelled'}
        onClick={() => (done ? reopen.mutate(task.id) : complete.mutate(task.id))}
      />
      <div className="row-main">
        <Link className="row-title" to={`/tasks/${task.id}`}>{task.title}</Link>
        <span className="row-meta">
          {task.status === 'Cancelled' && <span className="badge">{statusLabel('Cancelled')}</span>}
          {task.status === 'Ongoing' && <span className="badge ongoing">{statusLabel('Ongoing')}</span>}
          {task.dueDateUtc && (
            <span className={overdue ? 'overdue' : undefined}>{formatDue(task.dueDateUtc, task.hasDueTime, zone)}</span>
          )}
          {task.priority !== 'None' && <span className={`badge prio-${task.priority.toLowerCase()}`}>{priorityLabel(task.priority)}</span>}
          {task.tags.map((tag) => (
            <span key={tag} className="tag">
              #{tag}
            </span>
          ))}
        </span>
      </div>
      <div className="row-actions">
        {!done && (
          <button className="link" disabled={busy} onClick={() => cancel.mutate(task.id)}>
            {t('common.cancel')}
          </button>
        )}
        <button className="link danger" disabled={busy} onClick={() => remove.mutate(task.id)}>
          {t('common.delete')}
        </button>
      </div>
    </li>
  )
}
