import { useEffect, useRef, useState } from 'react'
import { IoArrowBack, IoCalendarOutline, IoPersonCircleOutline, IoSunnyOutline } from 'react-icons/io5'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router'
import { useAuth } from './auth/useAuth'
import { AppointmentDetailPage } from './pages/AppointmentDetailPage'
import { AuthPage } from './pages/AuthPage'
import { CalendarPage } from './pages/CalendarPage'
import { FeedPage } from './pages/FeedPage'
import { NoteDetailPage } from './pages/NoteDetailPage'
import { TaskDetailPage } from './pages/TaskDetailPage'
import { TodayPage } from './pages/TodayPage'

/** Header titles per route - same as the mobile app's screen titles. */
function titleFor(path: string): string {
  if (path.startsWith('/today')) return 'Today'
  if (path.startsWith('/calendar')) return 'Calendar'
  if (path.startsWith('/tasks/')) return 'Task'
  if (path.startsWith('/appointments/')) return 'Appointment'
  if (path.startsWith('/notes/')) return 'Note'
  return 'AI Planner'
}

/**
 * Same shell as the mobile app: a header with the title, Today / Calendar /
 * account icons, and a back arrow on inner pages. The feed's filter bar sits
 * at the bottom (see FeedPage).
 */
function Layout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isHome = pathname === '/feed'

  // Back within the app if there's history, otherwise home.
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/feed'))

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          {!isHome && (
            <button className="icon-button" onClick={back} aria-label="Back" title="Back">
              <IoArrowBack />
            </button>
          )}
          <h1 className="app-title">{titleFor(pathname)}</h1>
          <nav className="header-actions" aria-label="Views">
            <button className={`icon-button${pathname.startsWith('/today') ? ' active' : ''}`} onClick={() => navigate('/today')} aria-label="Today" title="Today">
              <IoSunnyOutline />
            </button>
            <button className={`icon-button${pathname.startsWith('/calendar') ? ' active' : ''}`} onClick={() => navigate('/calendar')} aria-label="Calendar" title="Calendar">
              <IoCalendarOutline />
            </button>
            <AccountMenu />
          </nav>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}

/** 👤 → name, email, Sign out (the mobile app shows the same in a dialog). */
function AccountMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div className="menu-anchor" ref={ref}>
      <button className="icon-button" onClick={() => setOpen((o) => !o)} aria-label="Account" aria-expanded={open} title="Account">
        <IoPersonCircleOutline />
      </button>
      {open && (
        <div className="menu" role="menu">
          <strong>{user?.displayName}</strong>
          <span className="muted">{user?.email}</span>
          <button className="menu-item danger" role="menuitem" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export function App() {
  const { user } = useAuth()

  if (user === undefined) return <div className="splash">Loading…</div>
  if (user === null) return <AuthPage />

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
          <Route path="/appointments/:id" element={<AppointmentDetailPage />} />
          <Route path="/notes/:id" element={<NoteDetailPage />} />
          {/* The old list pages are now filters of the feed. */}
          <Route path="/tasks" element={<Navigate to="/feed?show=tasks" replace />} />
          <Route path="/notes" element={<Navigate to="/feed?show=notes" replace />} />
          <Route path="*" element={<Navigate to="/feed" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
