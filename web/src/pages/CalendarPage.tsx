import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { calendarApi } from '../api/endpoints'
import type { CalendarItem, CalendarView } from '@shared/types'
import { useAuth } from '../auth/useAuth'
import { AppointmentForm } from '../components/AppointmentForm'
import { KindIcon } from '../components/KindIcon'
import { CALENDAR_VIEWS, periodTitle, stepPeriod, visibleDays } from '@shared/calendar'
import { eventPassed } from '@shared/feed'
import { dateKey, formatDateKey, formatTime, todayKey } from '@shared/dates'
import { t } from '@shared/i18n'

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

  const title = periodTitle(view, anchor, zone.locale)

  return (
    <div className="page wide">
      <header className="page-header">
        <h1>{title}</h1>
        <div className="toolbar">
          <div className="segmented">
            {CALENDAR_VIEWS.map((v) => (
              <button key={v.view} className={view === v.view ? 'active' : undefined} onClick={() => setView(v.view)}>
                {v.label}
              </button>
            ))}
          </div>
          <button onClick={() => setAnchor(stepPeriod(view, anchor, -1))} aria-label={t('calendar.previous')}>
            <span className="flip-rtl">‹</span>
          </button>
          <button onClick={() => setAnchor(today)}>{t('date.today')}</button>
          <button onClick={() => setAnchor(stepPeriod(view, anchor, 1))} aria-label={t('calendar.next')}>
            <span className="flip-rtl">›</span>
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
            <button className="day-header" onClick={() => setAddingOn(day)} title={t('calendar.addEvent')}>
              {formatDateKey(day, zone.locale, view === 'month' ? { day: 'numeric' } : { weekday: 'short', day: 'numeric' })}
            </button>
            <ul>
              {(itemsByDay.get(day) ?? []).map((item) => (
                <li key={item.id} className={`cal-item ${item.itemType.toLowerCase()} status-${item.status.toLowerCase()}${item.itemType === 'Appointment' && eventPassed(item) ? ' passed' : ''}`}>
                  <KindIcon kind={item.itemType} className="cal-icon" />
                  {item.hasTime && <span className="cal-time">{formatTime(item.startUtc, zone)}</span>}
                  <Link className="cal-title" to={`/${item.itemType === 'Task' ? 'tasks' : 'appointments'}/${item.id}`}>{item.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

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
