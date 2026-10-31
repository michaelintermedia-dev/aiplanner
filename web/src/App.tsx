import { isRtl, languageOf, setLocale, t } from '@shared/i18n'
import { useEffect, type ComponentType } from 'react'
import {
  IoAlbums,
  IoAlbumsOutline,
  IoArrowBack,
  IoCalendar,
  IoCalendarOutline,
  IoSettings,
  IoSettingsOutline,
  IoSunny,
  IoSunnyOutline,
} from 'react-icons/io5'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router'
import { useAuth } from './auth/useAuth'
import { CaptureDock } from './components/CaptureDock'
import { PullToRefresh } from './components/PullToRefresh'
import { AdminUsagePage } from './pages/AdminUsagePage'
import { AppointmentDetailPage } from './pages/AppointmentDetailPage'
import { AuthPage } from './pages/AuthPage'
import { CalendarPage } from './pages/CalendarPage'
import { FeedPage } from './pages/FeedPage'
import { useNotificationDelivery } from './lib/useNotificationDelivery'
import { useAccountAppearance } from './lib/appearance'
import { useAccountFirstDayOfWeek } from './lib/weekStart'
import { NoteDetailPage } from './pages/NoteDetailPage'
import { SettingsPage } from './pages/SettingsPage'
import { EmailConfirmBanner } from './components/EmailConfirmBanner'
import { SharePage } from './pages/SharePage'
import { TaskDetailPage } from './pages/TaskDetailPage'
import { TodayPage } from './pages/TodayPage'
import { isTabPage, TABS } from './lib/tabs'

/** Each tab's icon, and the filled one while it's open (same as the app). */
const TAB_ICONS: [ComponentType, ComponentType][] = [
  [IoAlbumsOutline, IoAlbums],
  [IoSunnyOutline, IoSunny],
  [IoCalendarOutline, IoCalendar],
  [IoSettingsOutline, IoSettings],
]

/** Header titles per route - same as the mobile app's screen titles. */
function titleFor(path: string): string {
  if (path.startsWith('/today')) return t('nav.today')
  if (path.startsWith('/calendar')) return t('nav.calendar')
  if (path.startsWith('/tasks/')) return t('kind.task')
  if (path.startsWith('/appointments/')) return t('kind.event')
  if (path.startsWith('/notes/')) return t('kind.note')
  if (path.startsWith('/settings')) return t('nav.settings')
  if (path.startsWith('/feed')) return t('app.name')
  if (path.startsWith('/admin/usage')) return t('admin.aiCosts')
  return t('app.name')
}

/**
 * Same shell as the mobile app (spec v2): a header with the title, the bottom
 * navigation Feed · Today · Calendar · Settings, and inner pages (an item)
 * on top with a back arrow instead of the bar.
 */
function Layout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const onTab = isTabPage(pathname)
  useNotificationDelivery()
  useAccountAppearance()
  useAccountFirstDayOfWeek()

  // Back within the app if there's history, otherwise home.
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/feed'))

  return (
    <div className={`app${onTab ? ' with-nav' : ''}`}>
      <header className="app-header">
        <div className="app-header-inner">
          {!onTab && (
            <button className="icon-button" onClick={back} aria-label={t('nav.back')} title={t('nav.back')}>
              <IoArrowBack className="flip-rtl" />
            </button>
          )}
          <h1 className="app-title">
            {/* The cat next to the name on the home screen, like the app. */}
            {titleFor(pathname) === t('app.name') && <img src="/icon-192.png" alt="" className="app-logo" />}
            {titleFor(pathname)}
          </h1>
        </div>
      </header>
      <main className="content">
        <PullToRefresh />
        <EmailConfirmBanner />
        <Outlet />
      </main>
      {/* Phone width: new entries float over every page (desktop: inline on Feed / Today). */}
      <CaptureDock />
      {onTab && (
        <nav className="tab-bar" aria-label={t('nav.views')}>
          <div className="tab-bar-inner">
            {TABS.map((tab, i) => {
              const active = pathname === tab.path
              const Icon = TAB_ICONS[i][active ? 1 : 0]
              return (
                <button
                  key={tab.path}
                  className={active ? 'active' : undefined}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    if (active) window.scrollTo({ top: 0, behavior: 'smooth' })
                    else navigate(tab.path)
                  }}>
                  <span className="tab-icon">
                    <Icon />
                  </span>
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
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
          <Route path="/share" element={<SharePage />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
          <Route path="/appointments/:id" element={<AppointmentDetailPage />} />
          <Route path="/notes/:id" element={<NoteDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin/usage" element={<AdminUsagePage />} />
          {/* The old list pages are now the feed's type chips. */}
          <Route path="/tasks" element={<Navigate to="/feed" replace />} />
          <Route path="/notes" element={<Navigate to="/feed" replace />} />
          <Route path="*" element={<Navigate to="/feed" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
