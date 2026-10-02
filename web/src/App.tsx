import { isRtl, languageOf, setLocale, t } from '@shared/i18n'
import { useEffect, useRef, useState } from 'react'
import { IoArrowBack, IoCalendarOutline, IoPersonCircleOutline, IoSunnyOutline } from 'react-icons/io5'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router'
import { useAuth } from './auth/useAuth'
import { AppointmentDetailPage } from './pages/AppointmentDetailPage'
import { AuthPage } from './pages/AuthPage'
import { CalendarPage } from './pages/CalendarPage'
import { FeedPage } from './pages/FeedPage'
import { useNotificationDelivery } from './lib/useNotificationDelivery'
import { NoteDetailPage } from './pages/NoteDetailPage'
import { SettingsPage } from './pages/SettingsPage'
import { TaskDetailPage } from './pages/TaskDetailPage'
import { TodayPage } from './pages/TodayPage'

/** Header titles per route - same as the mobile app's screen titles. */
function titleFor(path: string): string {
  if (path.startsWith('/today')) return t('nav.today')
  if (path.startsWith('/calendar')) return t('nav.calendar')
  if (path.startsWith('/tasks/')) return t('kind.task')
  if (path.startsWith('/appointments/')) return t('kind.event')
  if (path.startsWith('/notes/')) return t('kind.note')
  if (path.startsWith('/settings')) return t('nav.settings')
  return t('app.name')
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
  useNotificationDelivery()

  // Back within the app if there's history, otherwise home.
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/feed'))

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          {!isHome && (
            <button className="icon-button" onClick={back} aria-label={t('nav.back')} title={t('nav.back')}>
              <IoArrowBack className="flip-rtl" />
            </button>
          )}
          <h1 className="app-title">{titleFor(pathname)}</h1>
          <nav className="header-actions" aria-label={t('nav.views')}>
            <button className={`icon-button${pathname.startsWith('/today') ? ' active' : ''}`} onClick={() => navigate('/today')} aria-label={t('nav.today')} title={t('nav.today')}>
              <IoSunnyOutline />
            </button>
            <button className={`icon-button${pathname.startsWith('/calendar') ? ' active' : ''}`} onClick={() => navigate('/calendar')} aria-label={t('nav.calendar')} title={t('nav.calendar')}>
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

/** Account → name, email, Settings, Sign out (the mobile app shows the same in a dialog). */
function AccountMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
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
      <button className="icon-button" onClick={() => setOpen((o) => !o)} aria-label={t('nav.account')} aria-expanded={open} title={t('nav.account')}>
        <IoPersonCircleOutline />
      </button>
      {open && (
        <div className="menu" role="menu">
          <strong>{user?.displayName}</strong>
          <span className="muted">{user?.email}</span>
          <button
            className="menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              navigate('/settings')
            }}>
            {t('nav.settings')}
          </button>
          <button className="menu-item danger" role="menuitem" onClick={() => void logout()}>
            {t('auth.signOut')}
          </button>
        </div>
      )}
    </div>
  )
}

export function App() {
  const { user, zone } = useAuth()
  // The UI language follows the user's locale (the browser's before signing in).
  const language = languageOf(zone.locale)
  setLocale(zone.locale)
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = isRtl(language) ? 'rtl' : 'ltr'
  }, [language])

  if (user === undefined) return <div className="splash">{t('common.loading')}</div>
  if (user === null) return <AuthPage key={language} />

  return (
    // Keyed by language: a language change re-renders every screen in it.
    <BrowserRouter key={language}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
          <Route path="/appointments/:id" element={<AppointmentDetailPage />} />
          <Route path="/notes/:id" element={<NoteDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* The old list pages are now filters of the feed. */}
          <Route path="/tasks" element={<Navigate to="/feed?show=tasks" replace />} />
          <Route path="/notes" element={<Navigate to="/feed?show=notes" replace />} />
          <Route path="*" element={<Navigate to="/feed" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
