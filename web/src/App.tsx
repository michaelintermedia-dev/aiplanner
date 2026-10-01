import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes } from 'react-router'
import { useAuth } from './auth/useAuth'
import { AppointmentDetailPage } from './pages/AppointmentDetailPage'
import { AuthPage } from './pages/AuthPage'
import { CalendarPage } from './pages/CalendarPage'
import { FeedPage } from './pages/FeedPage'
import { NoteDetailPage } from './pages/NoteDetailPage'
import { TaskDetailPage } from './pages/TaskDetailPage'
import { TodayPage } from './pages/TodayPage'

function Layout() {
  const { user, logout } = useAuth()
  return (
    <div className="shell">
      <nav className="sidebar">
        <span className="brand">AI Planner</span>
        <NavLink to="/feed">Feed</NavLink>
        <NavLink to="/today">Today</NavLink>
        <NavLink to="/calendar">Calendar</NavLink>
        <div className="sidebar-footer">
          <span className="muted" title={user?.email}>
            {user?.displayName}
          </span>
          <button className="link" onClick={logout}>
            Sign out
          </button>
        </div>
      </nav>
      <main className="content">
        <Outlet />
      </main>
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
