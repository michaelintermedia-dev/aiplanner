import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { calendarApi } from '../api/endpoints'
import type { CalendarItem, CalendarView } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { AppointmentForm } from '../components/AppointmentForm'
import { addDays, dateKey, formatDateKey, formatTime, todayKey } from '../lib/dates'

/** Monday of the week containing `key` (weeks start on Monday, matching the API). */
function weekStart(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
  return addDays(key, -weekday)
}

function visibleDays(view: CalendarView, anchor: string): string[] {
  if (view === 'day') return [anchor]
  if (view === 'week') return Array.from({ length: 7 }, (_, i) => addDays(weekStart(anchor), i))
  // Month: full Monday-to-Sunday weeks covering the whole month.
  const first = `${anchor.slice(0, 7)}-01`
  const last = addDays(step('month', first, 1), -1)
  const end = addDays(weekStart(last), 6)
  const days: string[] = []
  for (let day = weekStart(first); day <= end; day = addDays(day, 1)) days.push(day)
  return days
}

function step(view: CalendarView, anchor: string, direction: 1 | -1): string {
  if (view === 'day') return addDays(anchor, direction)
  if (view === 'week') return addDays(anchor, 7 * direction)
  const [y, m] = anchor.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1 + direction, 1))
  return next.toISOString().slice(0, 10)
}

export function CalendarPage() {
  const { zone } = useAuth()
  const today = todayKey(zone.timeZone)
  const [view, setView] = useState<CalendarView>('week')
  const [anchor, setAnchor] = useState(today)
  const [addingOn, setAddingOn] = useState<string | null>(null)

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

  const title =
    view === 'month'
      ? formatDateKey(anchor, zone.locale, { month: 'long', year: 'numeric' })
      : view === 'week'
        ? `${formatDateKey(days[0], zone.locale, { month: 'short', day: 'numeric' })} – ${formatDateKey(days[6], zone.locale, { month: 'short', day: 'numeric' })}`
        : formatDateKey(anchor, zone.locale)

  return (
    <div className="page wide">
      <header className="page-header">
        <h1>{title}</h1>
        <div className="toolbar">
          <div className="segmented">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button key={v} className={view === v ? 'active' : undefined} onClick={() => setView(v)}>
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={() => setAnchor(step(view, anchor, -1))} aria-label="Previous">
            ‹
          </button>
          <button onClick={() => setAnchor(today)}>Today</button>
          <button onClick={() => setAnchor(step(view, anchor, 1))} aria-label="Next">
            ›
          </button>
        </div>
      </header>

      {addingOn && <AppointmentForm initialDate={addingOn} onDone={() => setAddingOn(null)} />}
      {error && <p className="error">{error.message}</p>}

      <div className={`calendar ${view}`}>
        {days.map((day) => (
          <div
            key={day}
            className={`day${day === today ? ' today' : ''}${view === 'month' && day.slice(0, 7) !== anchor.slice(0, 7) ? ' outside' : ''}`}
          >
            <button className="day-header" onClick={() => setAddingOn(day)} title="Add appointment">
              {formatDateKey(day, zone.locale, view === 'month' ? { day: 'numeric' } : { weekday: 'short', day: 'numeric' })}
            </button>
            <ul>
              {(itemsByDay.get(day) ?? []).map((item) => (
                <li key={item.id} className={`cal-item ${item.itemType.toLowerCase()} status-${item.status.toLowerCase()}`}>
                  {item.hasTime && <span className="cal-time">{formatTime(item.startUtc, zone)}</span>}
                  <span className="cal-title">{item.title}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {data && data.ongoingTasks.length > 0 && (
        <section className="section">
          <h2>Ongoing</h2>
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
