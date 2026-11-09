import { IoRepeat } from 'react-icons/io5'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { calendarApi } from '../api/endpoints'
import type { CalendarItem, CalendarView } from '@shared/types'
import { useAuth } from '../auth/useAuth'
import { KindIcon } from '../components/KindIcon'
import { periodTitle, stepPeriod, visibleDays } from '@shared/calendar'
import { eventPassed } from '@shared/feed'
import { dateKey, formatDateKey, formatTime, todayKey } from '@shared/dates'
import { t } from '@shared/i18n'
import { useFirstDayOfWeek } from '../lib/weekStart'
import { useSwipeNav } from '../lib/useSwipeNav'

export function CalendarPage() {
  // Weeks are laid out from the chosen first day: re-render when it changes.
  useFirstDayOfWeek()
  const { zone } = useAuth()
  const today = todayKey(zone.timeZone)
  // Month only (user's call, 2026-11-09; same as the app): a single day is the Today page.
  const view = 'month' as CalendarView
  // The selected day (a click on a day, like the app's tap): its items are listed under the month.
  const [anchor, setAnchor] = useState(today)

  const { data, error } = useQuery({
    queryKey: ['calendar', view, anchor],
    queryFn: () => calendarApi.get(view, anchor),
  })

  const days = visibleDays(view, anchor)
  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>()
    for (const item of data?.items ?? []) {
      const key = dateKey(item.startUtc, zone.timeZone)
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return map
  }, [data, zone.timeZone])

  const title = periodTitle(view, anchor, zone.locale)
  // Like the app: a new month selects today when it's this month, else the day the step lands on.
  const move = (direction: 1 | -1) =>
    setAnchor((a) => {
      const next = stepPeriod(view, a, direction)
      return next.slice(0, 7) === today.slice(0, 7) ? today : next
    })
  const selectedItems = itemsByDay.get(anchor) ?? []
  const itemLink = (item: CalendarItem) =>
    // One date of a repeating event: open it at that date (Skip is there).
    `/${item.itemType === 'Task' ? 'tasks' : 'appointments'}/${item.id}${item.repeats && item.itemType === 'Appointment' ? `?at=${encodeURIComponent(item.startUtc)}` : ''}`
  // Swipe sideways on the calendar (or ← →) = the arrows.
  const swipe = useSwipeNav(move)

  return (
    <div className="page wide">
      <header className="page-header">
        <h1>{title}</h1>
        <div className="toolbar">
          <button onClick={() => move(-1)} aria-label={t('calendar.previous')}>
            <span className="flip-rtl">‹</span>
          </button>
          <button onClick={() => setAnchor(today)}>{t('date.today')}</button>
          <button onClick={() => move(1)} aria-label={t('calendar.next')}>
            <span className="flip-rtl">›</span>
          </button>
        </div>
      </header>

      {error && <p className="error">{error.message}</p>}

      <div key={swipe.slide.n} className={`calendar ${view}${swipe.slide.n ? ` slide-from-${swipe.slide.from}` : ''}`} {...swipe.handlers}>
        {days.map((day) => (
          <div
            key={day}
            className={`day${day === today ? ' today' : ''}${day === anchor ? ' selected' : ''}${view === 'month' && day.slice(0, 7) !== anchor.slice(0, 7) ? ' outside' : ''}`}
            onClick={() => setAnchor(day)}
          >
            {/* A click on a day selects it - its items are listed below (same as the app, 2026-11-09). */}
            <button className="day-header" onClick={() => setAnchor(day)} aria-pressed={day === anchor}>
              {formatDateKey(day, zone.locale, view === 'month' ? { day: 'numeric' } : { weekday: 'short', day: 'numeric' })}
            </button>
            <ul>
              {(itemsByDay.get(day) ?? []).map((item) => (
                <li key={item.id} className={`cal-item ${item.itemType.toLowerCase()} status-${item.status.toLowerCase()}${item.itemType === 'Appointment' && eventPassed(item) ? ' passed' : ''}`}>
                  <KindIcon kind={item.itemType} className="cal-icon" />
                  {item.hasTime && <span className="cal-time">{formatTime(item.startUtc, zone)}</span>}
                  <Link className="cal-title" to={itemLink(item)} onClick={(e) => e.stopPropagation()}>
                    {item.title}
                  </Link>
                  {item.repeats && <IoRepeat className="repeat-icon" title={t('repeat.repeats')} aria-label={t('repeat.repeats')} />}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <section className="section cal-day-list">
        <h2 className={anchor === today ? 'is-today' : undefined}>
          {formatDateKey(anchor, zone.locale, { weekday: 'long', day: 'numeric', month: 'long' })}
          {anchor === today ? ` · ${t('date.today')}` : ''}
        </h2>
        {selectedItems.length > 0 ? (
          <ul className="list">
            {selectedItems.map((item) => (
              <li key={`${item.id}-${item.startUtc}`} className={`row cal-row ${item.itemType.toLowerCase()} status-${item.status.toLowerCase()}${item.itemType === 'Appointment' && eventPassed(item) ? ' passed' : ''}`}>
                <KindIcon kind={item.itemType} className="cal-icon" />
                <span className="cal-row-time">{item.hasTime ? formatTime(item.startUtc, zone) : t('calendar.allDay')}</span>
                <Link className="row-title" to={itemLink(item)}>
                  {item.title}
                </Link>
                {item.repeats && <IoRepeat className="repeat-icon" title={t('repeat.repeats')} aria-label={t('repeat.repeats')} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">{t('calendar.nothingPlanned')}</p>
        )}
      </section>

      {data && data.ongoingTasks.length > 0 && (
        <section className="section">
          <h2>{t('today.ongoing')}</h2>
          <ul className="chips">
            {data.ongoingTasks.map((t) => (
              <li key={t.id}>{t.title}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
