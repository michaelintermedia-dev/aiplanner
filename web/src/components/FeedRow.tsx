import { eventTime, feedItemPassed, isDone, rowIndicator } from '@shared/feed'
import { highlight } from '@shared/highlight'
import { t } from '@shared/i18n'
import type { FeedItem } from '@shared/types'
import { IoCheckbox, IoCheckmarkCircle, IoEllipseOutline, IoNotificationsOutline, IoRepeat, IoSquareOutline, IoTrashOutline } from 'react-icons/io5'
import { Link } from 'react-router'
import { tasksApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { useAction } from '../lib/useAction'
import { useLongPress } from '../lib/useLongPress'
import { KIND_ICON } from './kindIcons'

const DETAIL_PATH = { Task: 'tasks', Appointment: 'appointments', Note: 'notes' } as const

/**
 * One feed entry, for triage (spec v2): its control (a task's tick box, an
 * event's start time, a note's icon), the title and ONE indicator - the next
 * reminder, else the date when it isn't today, else the repeat icon, else a
 * note's first line (rowIndicator). High priority is the bar on its edge.
 * Place, people, tags and the rest are on the item's page.
 *
 * Selecting (`selection` set): the row is a checkbox - a click picks it. Not
 * selecting: a trash button on hover deletes just this one (`onDelete`).
 */
export function FeedRow({
  item,
  selection,
  onDelete,
  onLongPress,
  words = [],
}: {
  item: FeedItem
  /** Search words to mark in the title. */
  words?: string[]
  selection?: { selected: boolean; onToggle: () => void }
  onDelete?: () => void
  /** Touch: a long-press starts selecting (with this row), like the mobile app. */
  onLongPress?: () => void
}) {
  const longPress = useLongPress(onLongPress)
  const { zone } = useAuth()
  const complete = useAction(tasksApi.complete)
  const reopen = useAction(tasksApi.reopen)
  const done = isDone(item)
  const passed = feedItemPassed(item)
  const indicator = rowIndicator(item, zone)
  const time = eventTime(item, zone)
  const KindIcon = KIND_ICON[item.kind]
  const classes = `feed-row kind-${item.kind.toLowerCase()}${done ? ' done' : ''}${passed ? ' passed' : ''}${item.priority === 'High' ? ' high' : ''}`

  const content = (
    <>
      <span className="feed-line">
        <span className="feed-title">
          <Marked text={item.title} words={words} />
        </span>
        {indicator && indicator.type !== 'text' && (
          <span className={`row-indicator${indicator.type === 'reminder' && indicator.today ? ' today' : ''}`}>
            {indicator.type === 'reminder' ? (
              <>
                {indicator.repeats ? <IoRepeat aria-hidden /> : <IoNotificationsOutline aria-hidden />}
                <span className="visually-hidden">{t('feed.reminderAt', { when: indicator.label })}</span>
                <span aria-hidden>{indicator.label}</span>
              </>
            ) : indicator.type === 'repeat' ? (
              <IoRepeat title={t('repeat.repeats')} aria-label={t('repeat.repeats')} />
            ) : (
              indicator.label
            )}
          </span>
        )}
      </span>
      {indicator?.type === 'text' && (
        <span className="feed-snippet one-line">
          <Marked text={indicator.label} words={words} />
        </span>
      )}
    </>
  )

  if (selection) {
    return (
      <li className={`${classes} selecting${selection.selected ? ' selected' : ''}`} onClick={selection.onToggle}>
        <button
          type="button"
          className="kind-icon select-box"
          role="checkbox"
          aria-checked={selection.selected}
          aria-label={t('select.item', { title: item.title })}
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
    <li className={classes} {...longPress}>
      {item.kind === 'Task' ? (
        <button
          className="kind-icon"
          aria-label={item.status === 'Completed' ? t('task.markNotDone') : t('task.markDone')}
          disabled={complete.isPending || reopen.isPending || item.status === 'Cancelled'}
          onClick={() => (done ? reopen.mutate(item.id) : complete.mutate(item.id))}>
          {item.status === 'Completed' ? <IoCheckbox aria-hidden /> : <IoSquareOutline aria-hidden />}
        </button>
      ) : time ? (
        <span className="time-badge">{time}</span>
      ) : (
        <span className="kind-icon" aria-hidden="true">
          <KindIcon />
        </span>
      )}
      <Link to={`/${DETAIL_PATH[item.kind]}/${item.id}`} className="feed-main">
        {content}
      </Link>
      {onDelete && (
        <button type="button" className="icon-button row-delete" onClick={onDelete} aria-label={t('common.deleteItem', { title: item.title })} title={t('common.delete')}>
          <IoTrashOutline aria-hidden />
        </button>
      )}
    </li>
  )
}

/** The text with the search words marked. */
function Marked({ text, words }: { text: string; words: string[] }) {
  if (!words.length) return <>{text}</>
  return <>{highlight(text, words).map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : p.text))}</>
}
