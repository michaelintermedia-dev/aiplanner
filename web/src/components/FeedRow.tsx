import { feedItemPassed, feedWhen, isDone, KIND_LABEL } from '@shared/feed'
import type { FeedItem } from '@shared/types'
import { IoCheckbox, IoCheckmarkCircle, IoEllipseOutline, IoMicOutline, IoSquareOutline, IoTrashOutline } from 'react-icons/io5'
import { Link } from 'react-router'
import { tasksApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { useAction } from '../lib/useAction'
import { KIND_ICON } from './kindIcons'

const DETAIL_PATH = { Task: 'tasks', Appointment: 'appointments', Note: 'notes' } as const

/**
 * One feed entry, marked with its type's filter-tab icon. A task's icon is its
 * tick box (empty square / filled check); everything opens its detail view.
 *
 * Selecting (`selection` set): the row is a checkbox - a click picks it. Not
 * selecting: a trash button on hover deletes just this one (`onDelete`).
 */
export function FeedRow({
  item,
  selection,
  onDelete,
}: {
  item: FeedItem
  selection?: { selected: boolean; onToggle: () => void }
  onDelete?: () => void
}) {
  const { zone } = useAuth()
  const complete = useAction(tasksApi.complete)
  const reopen = useAction(tasksApi.reopen)
  const done = isDone(item)
  const passed = feedItemPassed(item)
  const when = feedWhen(item, zone)
  const KindIcon = KIND_ICON[item.kind]

  const content = (
    <>
      <span className="feed-title">{item.title}</span>
      {item.snippet && <span className="feed-snippet">{item.snippet}</span>}
      <span className="row-meta">
        <span className="kind-label">{KIND_LABEL[item.kind]}</span>
        {when && <span>{when}</span>}
        {item.location && <span>📍 {item.location}</span>}
        {passed && <span className="badge status-passed">Passed</span>}
        {item.status && item.status !== 'Scheduled' && item.status !== 'Planned' && item.status !== 'Inbox' && (
          <span className={`badge status-${item.status.toLowerCase()}`}>{item.status}</span>
        )}
        {item.priority && <span className={`badge prio-${item.priority.toLowerCase()}`}>{item.priority}</span>}
        {item.tags.map((t) => (
          <span key={t} className="tag">#{t}</span>
        ))}
        {item.fromCapture && <IoMicOutline className="muted" title="Created from a capture" aria-label="Created from a capture" />}
      </span>
    </>
  )
  const classes = `feed-row kind-${item.kind.toLowerCase()}${done ? ' done' : ''}${passed ? ' passed' : ''}`

  if (selection) {
    return (
      <li className={`${classes} selecting${selection.selected ? ' selected' : ''}`} onClick={selection.onToggle}>
        <button
          type="button"
          className="kind-icon select-box"
          role="checkbox"
          aria-checked={selection.selected}
          aria-label={`Select ${item.title}`}
          onClick={(e) => {
            e.stopPropagation()
            selection.onToggle()
          }}>
          {selection.selected ? <IoCheckmarkCircle aria-hidden /> : <IoEllipseOutline aria-hidden />}
        </button>
        <div className="feed-main">{content}</div>
      </li>
    )
  }

  return (
    <li className={classes}>
      {item.kind === 'Task' ? (
        <button
          className="kind-icon"
          aria-label={item.status === 'Completed' ? 'Mark as not done' : 'Mark as done'}
          disabled={complete.isPending || reopen.isPending || item.status === 'Cancelled'}
          onClick={() => (done ? reopen.mutate(item.id) : complete.mutate(item.id))}>
          {item.status === 'Completed' ? <IoCheckbox aria-hidden /> : <IoSquareOutline aria-hidden />}
        </button>
      ) : (
        <span className="kind-icon" aria-hidden="true">
          <KindIcon />
        </span>
      )}
      <Link to={`/${DETAIL_PATH[item.kind]}/${item.id}`} className="feed-main">
        {content}
      </Link>
      {onDelete && (
        <button type="button" className="icon-button row-delete" onClick={onDelete} aria-label={`Delete ${item.title}`} title="Delete">
          <IoTrashOutline aria-hidden />
        </button>
      )}
    </li>
  )
}
