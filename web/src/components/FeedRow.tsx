import { feedWhen, isDone, KIND_LABEL } from '@shared/feed'
import type { FeedItem } from '@shared/types'
import { IoMicOutline } from 'react-icons/io5'
import { Link } from 'react-router'
import { tasksApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { useAction } from '../lib/useAction'

const DETAIL_PATH = { Task: 'tasks', Appointment: 'appointments', Note: 'notes' } as const

/** One feed entry. Tasks keep their tick box; everything opens its detail view. */
export function FeedRow({ item }: { item: FeedItem }) {
  const { zone } = useAuth()
  const complete = useAction(tasksApi.complete)
  const reopen = useAction(tasksApi.reopen)
  const done = isDone(item)
  const when = feedWhen(item, zone)

  return (
    <li className={`feed-row kind-${item.kind.toLowerCase()}${done ? ' done' : ''}`}>
      {item.kind === 'Task' ? (
        <button
          className={`check${item.status === 'Completed' ? ' checked' : ''}`}
          aria-label={item.status === 'Completed' ? 'Mark as not done' : 'Mark as done'}
          disabled={complete.isPending || reopen.isPending || item.status === 'Cancelled'}
          onClick={() => (done ? reopen.mutate(item.id) : complete.mutate(item.id))}
        />
      ) : (
        <span className="kind-dot" aria-hidden="true" />
      )}
      <Link to={`/${DETAIL_PATH[item.kind]}/${item.id}`} className="feed-main">
        <span className="feed-title">{item.title}</span>
        {item.snippet && <span className="feed-snippet">{item.snippet}</span>}
        <span className="row-meta">
          <span className="kind-label">{KIND_LABEL[item.kind]}</span>
          {when && <span>{when}</span>}
          {item.location && <span>📍 {item.location}</span>}
          {item.status && item.status !== 'Scheduled' && item.status !== 'Planned' && item.status !== 'Inbox' && (
            <span className={`badge status-${item.status.toLowerCase()}`}>{item.status}</span>
          )}
          {item.priority && <span className={`badge prio-${item.priority.toLowerCase()}`}>{item.priority}</span>}
          {item.tags.map((t) => (
            <span key={t} className="tag">#{t}</span>
          ))}
          {item.fromCapture && <IoMicOutline className="muted" title="Created from a capture" aria-label="Created from a capture" />}
        </span>
      </Link>
    </li>
  )
}
