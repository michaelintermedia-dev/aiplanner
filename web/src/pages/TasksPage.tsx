import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { tasksApi } from '../api/endpoints'
import { QuickAddTask } from '../components/QuickAddTask'
import { TaskRow } from '../components/TaskRow'

export function TasksPage() {
  const [showDone, setShowDone] = useState(false)
  const { data, isPending, error } = useQuery({
    queryKey: ['tasks', { showDone }],
    queryFn: () => tasksApi.list(showDone),
  })

  return (
    <div className="page">
      <header className="page-header">
        <h1>Tasks</h1>
        <div className="segmented">
          <button className={!showDone ? 'active' : undefined} onClick={() => setShowDone(false)}>
            Active
          </button>
          <button className={showDone ? 'active' : undefined} onClick={() => setShowDone(true)}>
            All
          </button>
        </div>
      </header>
      <QuickAddTask />
      {isPending && <p className="muted">Loading…</p>}
      {error && <p className="error">{error.message}</p>}
      {data &&
        (data.length > 0 ? (
          <ul className="list">
            {data.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        ) : (
          <p className="empty">No tasks yet. Add one above.</p>
        ))}
    </div>
  )
}
