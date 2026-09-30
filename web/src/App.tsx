import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes } from 'react-router'
import { useAuth } from './auth/useAuth'
import { AuthPage } from './pages/AuthPage'
import { CalendarPage } from './pages/CalendarPage'
import { TasksPage } from './pages/TasksPage'
import { TodayPage } from './pages/TodayPage'

function Layout() {
  const { user, logout } = useAuth()
  return (
    <div className="shell">
      <nav className="sidebar">
        <span className="brand">AI Planner</span>
        <NavLink to="/today">Today</NavLink>
        <NavLink to="/tasks">Tasks</NavLink>
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
          <Route path="/today" element={<TodayPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
