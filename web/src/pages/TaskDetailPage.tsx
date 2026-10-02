import { dateKey, formatDateKey, formatDue, formatTime, timeKey, zonedToUtc } from '@shared/dates'
import type { Reminder, Task, TaskPriority } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { tasksApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { ReminderList } from '../components/ReminderList'
import { ChangeType } from '../components/ChangeType'
import { SourceCapture } from '../components/SourceCapture'
import { describeReminder, remindersProblem } from '@shared/reminders'
import { useAction } from '../lib/useAction'
import { t } from '@shared/i18n'
import { priorityLabel, statusLabel } from '@shared/labels'

export function TaskDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { zone } = useAuth()
  // ?edit=1: just converted and something was guessed - start in the edit form.
  const [editing, setEditing] = useState(useSearchParams()[0].get('edit') === '1')
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

      {editing ? (
        <TaskEditForm task={task} onDone={() => setEditing(false)} />
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
          <ChangeType itemType="Task" id={task.id} />

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
            <button disabled={busy} onClick={() => setEditing(true)}>
              {t('common.edit')}
            </button>
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

      {task.sourceCaptureId && <SourceCapture captureId={task.sourceCaptureId} item={{ itemType: 'Task', itemId: task.id, title: task.title }} />}
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

function TaskEditForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const { zone } = useAuth()
  const update = useAction((body: Parameters<typeof tasksApi.update>[1]) => tasksApi.update(task.id, body))
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [notes, setNotes] = useState(task.notes ?? '')
  const [date, setDate] = useState(task.dueDateUtc ? dateKey(task.dueDateUtc, zone.timeZone) : '')
  const [time, setTime] = useState(task.dueDateUtc && task.hasDueTime ? timeKey(task.dueDateUtc, zone.timeZone) : '')
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [ongoing, setOngoing] = useState(task.status === 'Ongoing')
  const [reminders, setReminders] = useState<Reminder[]>(task.reminders ?? [])
  const [tags, setTags] = useState(task.tags.join(', '))

  const reminderIssue = remindersProblem(reminders, { itemHasTime: !ongoing && !!date && !!time, isNote: false })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (reminderIssue) return
    const dueDateUtc = !ongoing && date ? zonedToUtc(date, time || null, zone.timeZone) : null
    update.mutate(
      {
        title: title.trim(),
        description: description.trim() || null,
        notes: notes.trim() || null,
        dueDateUtc,
        hasDueTime: !!dueDateUtc && !!time,
        priority,
        isOngoing: ongoing,
        reminders,
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h3>{t('task.edit')}</h3>
      <label>
        {t('item.title')}
        <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
      </label>
      <div className="form-row">
        <label>
          {t('task.dueDate')}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={ongoing} />
        </label>
        <label>
          {t('item.time')}
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={ongoing || !date} />
        </label>
        <label>
          {t('task.priority')}
          <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
            {['None', 'Low', 'Medium', 'High'].map((p) => (
              <option key={p} value={p}>
                {priorityLabel(p)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="field">
        <span>{t('item.reminder')}</span>
        <ReminderList value={reminders} onChange={setReminders} itemHasTime={!ongoing && !!date && !!time} />
      </div>
      <label className="inline-check">
        <input type="checkbox" checked={ongoing} onChange={(e) => setOngoing(e.target.checked)} />
        {t('task.ongoingCheck')}
      </label>
      <label>
        {t('task.tags')} <span className="muted">{t('item.commaSeparated')}</span>
        <input value={tags} onChange={(e) => setTags(e.target.value)} />
      </label>
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
        <button type="submit" className="primary" disabled={!title.trim() || !!reminderIssue || update.isPending}>
          {t('item.saveChanges')}
        </button>
      </div>
    </form>
  )
}
