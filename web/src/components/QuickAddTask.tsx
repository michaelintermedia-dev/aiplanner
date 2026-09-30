import { useState, type FormEvent } from 'react'
import { tasksApi } from '../api/endpoints'
import type { TaskPriority } from '@shared/types'
import { useAuth } from '../auth/useAuth'
import { zonedToUtc } from '@shared/dates'
import { useAction } from '../lib/useAction'

/**
 * Fast task entry: type a title and press Enter; date, time and priority are
 * optional. Natural-language capture ("call David tomorrow at 3pm") replaces
 * this with AI extraction in Phase 3.
 */
export function QuickAddTask() {
  const { zone } = useAuth()
  const create = useAction(tasksApi.create)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('None')
  const [ongoing, setOngoing] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    // A date without a time is sent as the start of that day in the user's timezone.
    const dueDateUtc = !ongoing && date ? zonedToUtc(date, time || null, zone.timeZone) : null
    create.mutate(
      { title: title.trim(), dueDateUtc, hasDueTime: !!dueDateUtc && !!time, priority, isOngoing: ongoing },
      {
        onSuccess: () => {
          setTitle('')
          setDate('')
          setTime('')
          setPriority('None')
          setOngoing(false)
        },
      },
    )
  }

  return (
    <form className="quick-add" onSubmit={submit}>
      <input
        className="quick-add-title"
        placeholder="Add a task…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Task title"
      />
      <div className="quick-add-options">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={ongoing} aria-label="Due date" />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          disabled={ongoing || !date}
          aria-label="Due time"
        />
        <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} aria-label="Priority">
          <option value="None">No priority</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>
        <label className="inline-check">
          <input type="checkbox" checked={ongoing} onChange={(e) => setOngoing(e.target.checked)} />
          Ongoing
        </label>
        <button type="submit" className="primary" disabled={!title.trim() || create.isPending}>
          Add
        </button>
      </div>
      {create.error && <p className="error">{create.error.message}</p>}
    </form>
  )
}
