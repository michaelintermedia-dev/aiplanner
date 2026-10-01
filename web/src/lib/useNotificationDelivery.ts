import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { notificationsApi } from '../api/endpoints'
import { browserNotificationsSupported, itemPath, onPermissionChange } from './notifications'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Web delivery for Phase 4: while the app is open, show the upcoming
 * notifications (from the backend's schedule) as browser notifications at
 * their time. Edits anywhere invalidate all queries, so the schedule
 * refetches and the timers follow automatically.
 */
export function useNotificationDelivery() {
  const navigate = useNavigate()
  const [permission, setPermission] = useState(() => (browserNotificationsSupported() ? Notification.permission : 'denied'))
  useEffect(() => onPermissionChange(() => setPermission(Notification.permission)), [])

  const { data } = useQuery({
    queryKey: ['notifications', 'upcoming'],
    queryFn: () => notificationsApi.upcoming(24),
    enabled: permission === 'granted',
    refetchInterval: 5 * 60 * 1000,
  })

  const timers = useRef(new Map<string, number>())

  useEffect(() => {
    if (!data) return
    const now = Date.now()
    const wanted = new Map(data.filter((n) => new Date(n.atUtc).getTime() - now < DAY_MS).map((n) => [n.key, n]))

    for (const [key, timer] of timers.current) {
      if (!wanted.has(key)) {
        clearTimeout(timer)
        timers.current.delete(key)
      }
    }
    for (const [key, n] of wanted) {
      if (timers.current.has(key)) continue
      const delay = Math.max(0, new Date(n.atUtc).getTime() - now)
      timers.current.set(
        key,
        window.setTimeout(() => {
          timers.current.delete(key)
          const shown = new Notification(n.title, { body: n.body ?? undefined, tag: n.key })
          shown.onclick = () => {
            window.focus()
            navigate(itemPath(n))
            shown.close()
          }
        }, delay),
      )
    }
  }, [data, navigate])

  useEffect(() => {
    const all = timers.current
    return () => {
      for (const timer of all.values()) clearTimeout(timer)
      all.clear()
    }
  }, [])
}
