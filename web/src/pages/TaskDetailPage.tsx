import { dateKey, formatDateKey, formatDue, formatTime, timeKey, zonedToUtc } from '@shared/dates'
import type { Reminder, Task, TaskPriority } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { tasksApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { ReminderPicker } from '../components/ReminderPicker'
import { SourceCapture } from '../components/SourceCapture'
import { describeReminder, reminderProblem } from '@shared/reminders'
import { useAction } from '../lib/useAction'

export function TaskDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { zone } = useAuth()
  const [editing, setEditing] = useState(false)
  // Once a delete starts, stop (re)fetching this item - it's about to 404.
  const [deleting, setDeleting] = useState(false)
  const { data: task, isPending, error } = useQuery({ queryKey: ['task', id], queryFn: () => tasksApi.get(id), enabled: !deleting })

  const complete = useAction(tasksApi.complete)
  const cancel = useAction(tasksApi.cancel)
  const reopen = useAction(tasksApi.reopen)
  const remove = useAction(tasksApi.remove, { forget: (taskId) => ['task', taskId] })
  const busy = complete.isPending || cancel.isPending || reopen.isPending || remove.isPending
  const actionError = complete.error ?? cancel.error ?? reopen.error ?? remove.error

  if (isPending) return <div className="page"><p className="muted">Loading…</p></div>
  if (error || !task) return <div className="page"><p className="error">{error?.message ?? 'Task not found.'}</p><Link to="/tasks">Back to tasks</Link></div>

  const closed = task.status === 'Completed' || task.status === 'Cancelled'

  return (
    <div className="page detail">

      {editing ? (
        <TaskEditForm task={task} onDone={() => setEditing(false)} />
      ) : (
        <>
          <header className="detail-header">
            <span className="kind task">Task</span>
            <h1 className={closed ? 'struck' : undefined}>{task.title}</h1>
            <div className="row-meta">
              <span className={`badge status-${task.status.toLowerCase()}`}>{task.status}</span>
              {task.priority !== 'None' && <span className={`badge prio-${task.priority.toLowerCase()}`}>{task.priority} priority</span>}
              {task.tags.map((t) => (
                <span key={t} className="tag">#{t}</span>
              ))}
            </div>
          </header>

          <dl className="facts">
            <dt>Due</dt>
            <dd>{task.dueDateUtc ? formatDue(task.dueDateUtc, task.hasDueTime, zone) : task.status === 'Ongoing' ? 'Ongoing — no deadline' : 'No due date'}</dd>
            <dt>Reminder</dt>
            <dd>{task.reminder ? describeReminder(task.reminder, zone) : 'None'}</dd>
            {task.completedAtUtc && (
              <>
                <dt>Completed</dt>
                <dd>{formatDue(task.completedAtUtc, true, zone)}</dd>
              </>
            )}
            <dt>Created</dt>
            <dd>
              {formatDateKey(dateKey(task.createdAtUtc, zone.timeZone), zone.locale, { month: 'short', day: 'numeric', year: 'numeric' })}, {formatTime(task.createdAtUtc, zone)}
            </dd>
          </dl>

          {task.description && <TextBlock title="Description" text={task.description} />}
          {task.notes && <TextBlock title="Notes" text={task.notes} />}
          {task.aiSummary && <TextBlock title="AI summary" text={task.aiSummary} />}

          {actionError && <p className="error">{actionError.message}</p>}
          <div className="detail-actions">
            {closed ? (
              <button className="primary" disabled={busy} onClick={() => reopen.mutate(task.id)}>
                ↺ Reopen
              </button>
            ) : (
              <>
                <button className="primary" disabled={busy} onClick={() => complete.mutate(task.id)}>
                  ✓ Complete
                </button>
                <button disabled={busy} onClick={() => cancel.mutate(task.id)}>
                  Cancel task
                </button>
              </>
            )}
            <button disabled={busy} onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              className="link danger"
              disabled={busy}
              onClick={() =>
                window.confirm(`Delete “${task.title}”?`) && (setDeleting(true), remove.mutate(task.id, { onSuccess: () => navigate('/tasks'), onError: () => setDeleting(false) }))
              }>
              Delete
            </button>
          </div>
        </>
      )}

      {task.sourceCaptureId && <SourceCapture captureId={task.sourceCaptureId} />}
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
  const [reminder, setReminder] = useState<Reminder | null>(task.reminder ?? null)
  const [tags, setTags] = useState(task.tags.join(', '))

  const reminderIssue = reminderProblem(reminder, { itemHasTime: !ongoing && !!date && !!time, isNote: false })

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
        reminder,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h3>Edit task</h3>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
      </label>
      <div className="form-row">
        <label>
          Due date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={ongoing} />
        </label>
        <label>
          Time
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={ongoing || !date} />
        </label>
        <label>
          Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
            {['None', 'Low', 'Medium', 'High'].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="field">
        <span>Reminder</span>
        <ReminderPicker value={reminder} onChange={setReminder} itemHasTime={!ongoing && !!date && !!time} />
      </div>
      <label className="inline-check">
        <input type="checkbox" checked={ongoing} onChange={(e) => setOngoing(e.target.checked)} />
        Ongoing (no deadline)
      </label>
      <label>
        Tags <span className="muted">(comma-separated)</span>
        <input value={tags} onChange={(e) => setTags(e.target.value)} />
      </label>
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
        <button type="submit" className="primary" disabled={!title.trim() || !!reminderIssue || update.isPending}>
          Save changes
        </button>
      </div>
    </form>
  )
}
