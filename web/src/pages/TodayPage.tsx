import { useNow } from '../lib/useNow'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { todayApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { AppointmentForm } from '../components/AppointmentForm'
import { AppointmentRow } from '../components/AppointmentRow'
import { useIsPhone } from '../lib/useIsPhone'
import { CaptureBar } from '../components/CaptureBar'
import { TaskRow } from '../components/TaskRow'
import { addDays, formatDateKey, formatDue, formatTime, relativeDayLabel, todayKey } from '@shared/dates'
import { onTabReselect } from '../lib/tabs'
import { useSwipeNav } from '../lib/useSwipeNav'
import { t } from '@shared/i18n'
import type { Today } from '@shared/types'


/**
 * Today - and, swiping sideways, ‹ › or ← →, any other day (user's request,
 * 2026-11-01; same as the app): that day's events and tasks due. Overdue and
 * ongoing are about now (today only); reminders: the next 7 days on today, the
 * ones going off that day on another day.
 */
export function TodayPage() {
  const isPhone = useIsPhone()
  const { user, zone } = useAuth()
  const now = useNow()
  const today = todayKey(zone.timeZone)
  // Days away from today, not a date: left open overnight it moves on to the new today
  // (it showed yesterday - bug fix 2026-11-02). useNow re-renders it every minute.
  const [offset, setOffset] = useState(0)
  const day = addDays(today, offset)
  const isToday = offset === 0
  const [addingAppointment, setAddingAppointment] = useState(false)
  const { data, isPending, error } = useQuery({ queryKey: ['today', day], queryFn: () => todayApi.get(isToday ? undefined : day) })
  const move = (direction: 1 | -1) => setOffset((o) => o + direction)
  // Back to today: click the Today tab again (the "Today" button here confused - 2026-11-10).
  useEffect(() => onTabReselect('/today', () => setOffset(0)), [])
  const swipe = useSwipeNav(move)

  return (
    <div className="page">
      <header className="page-header">
        <div>
          {isToday && <p className="muted">{t('today.hello', { name: user?.displayName ?? '' })}</p>}
          {/* The weekday small above the date: one long line ("воскресенье, 8 ноября") wrapped (2026-11-08). */}
          <p className={`today-weekday${isToday ? '' : ' other-day'}`}>{relativeDayLabel(offset, day, zone.locale)}</p>
          <h1 className={isToday ? undefined : 'other-day'}>
            {formatDateKey(day, zone.locale, { day: 'numeric', month: 'long' })}
            {isToday && <span className="clock">{formatTime(now.toISOString(), zone)}</span>}
          </h1>
        </div>
        <div className="toolbar">
          <button onClick={() => move(-1)} aria-label={t('calendar.previous')}>
            <span className="flip-rtl">‹</span>
          </button>
          <button onClick={() => move(1)} aria-label={t('calendar.next')}>
            <span className="flip-rtl">›</span>
          </button>
          <button onClick={() => setAddingAppointment(true)}>{t('today.addEvent')}</button>
        </div>
      </header>

      {addingAppointment && <AppointmentForm initialDate={day} onDone={() => setAddingAppointment(false)} />}
      {/* Phone width: the floating dock (App) has it. */}
      {!isPhone && <CaptureBar />}

      {isPending && <p className="muted">{t('common.loading')}</p>}
      {error && <p className="error">{error.message}</p>}
      {data && (
        <div key={swipe.slide.n} className={`sections day-swipe${swipe.slide.n ? ` slide-from-${swipe.slide.from}` : ''}`} {...swipe.handlers}>
          {/* Only sections with something in them; an empty day says so once (2026-11-02). */}
          {nothing(data, isToday) && <p className="empty">{t('calendar.nothingPlanned')}</p>}
          {data.appointmentsToday.length > 0 && (
            <Section title={t('today.schedule')}>
              {data.appointmentsToday.map((a) => (
                <AppointmentRow key={a.id} appointment={a} />
              ))}
            </Section>
          )}
          {data.overdueTasks.length > 0 && (
            <Section title={t('filter.when.overdue')} tone="warn">
              {data.overdueTasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </Section>
          )}
          {data.tasksDueToday.length > 0 && (
            <Section title={isToday ? t('today.dueToday') : t('today.due')}>
              {data.tasksDueToday.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </Section>
          )}
          {isToday && data.ongoingTasks.length > 0 && (
            <Section title={t('today.ongoing')}>
              {data.ongoingTasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </Section>
          )}
          {data.upcomingReminders.length > 0 && (
            <Section title={isToday ? t('today.upcomingReminders') : t('today.remindersDay')}>
              {data.upcomingReminders.map((r) => (
                <li key={r.key} className="row reminder">
                  <Link className="row-title" to={`/${r.sourceType === 'Task' ? 'tasks' : r.sourceType === 'Note' ? 'notes' : 'appointments'}/${r.sourceId}`}>
                    {r.title}
                  </Link>
                  <span className="row-meta">{formatDue(r.triggerAtUtc, true, zone)}</span>
                </li>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

/** A day with nothing on it at all. */
const nothing = (d: Today, isToday: boolean) =>
  d.appointmentsToday.length === 0 && d.tasksDueToday.length === 0 && d.overdueTasks.length === 0 &&
  (!isToday || d.ongoingTasks.length === 0) && d.upcomingReminders.length === 0

function Section({
  title,
  empty,
  tone,
  children,
}: {
  title: string
  empty?: string
  tone?: 'warn'
  children: ReactNode[]
}) {
  return (
    <section className={`section${tone ? ` ${tone}` : ''}`}>
      <h2>
        {title}
        {children.length > 0 && <span className="count">{children.length}</span>}
      </h2>
      {children.length > 0 ? <ul className="list">{children}</ul> : <p className="empty">{empty}</p>}
    </section>
  )
}
