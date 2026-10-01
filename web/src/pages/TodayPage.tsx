import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { todayApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { AppointmentForm } from '../components/AppointmentForm'
import { AppointmentRow } from '../components/AppointmentRow'
import { CaptureBar } from '../components/CaptureBar'
import { TaskRow } from '../components/TaskRow'
import { formatDateKey, formatDue, formatTime } from '@shared/dates'

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function TodayPage() {
  const { user, zone } = useAuth()
  const now = useNow()
  const [addingAppointment, setAddingAppointment] = useState(false)
  const { data, isPending, error } = useQuery({ queryKey: ['today'], queryFn: todayApi.get })

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="muted">Hello, {user?.displayName}</p>
          <h1>
            {data ? formatDateKey(data.date, zone.locale) : 'Today'}
            <span className="clock">{formatTime(now.toISOString(), zone)}</span>
          </h1>
        </div>
        <button onClick={() => setAddingAppointment(true)}>+ Appointment</button>
      </header>

      {addingAppointment && <AppointmentForm initialDate={data?.date} onDone={() => setAddingAppointment(false)} />}
      <CaptureBar />

      {isPending && <p className="muted">Loading…</p>}
      {error && <p className="error">{error.message}</p>}
      {data && (
        <div className="sections">
          <Section title="Schedule" empty="No appointments today.">
            {data.appointmentsToday.map((a) => (
              <AppointmentRow key={a.id} appointment={a} />
            ))}
          </Section>
          {data.overdueTasks.length > 0 && (
            <Section title="Overdue" tone="warn">
              {data.overdueTasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </Section>
          )}
          <Section title="Due today" empty="Nothing due today.">
            {data.tasksDueToday.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </Section>
          <Section title="Ongoing" empty="No ongoing tasks.">
            {data.ongoingTasks.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </Section>
          {data.upcomingReminders.length > 0 && (
            <Section title="Upcoming reminders">
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
