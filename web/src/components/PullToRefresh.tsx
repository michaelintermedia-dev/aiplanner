import { t } from '@shared/i18n'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { IoRefresh } from 'react-icons/io5'
import { isTouch, useIsPhone } from '../lib/useIsPhone'

/** How far to pull (after damping) before letting go refreshes. */
const TRIGGER = 64

/**
 * Pull down at the top of a page to refresh it - the mobile app's
 * pull-to-refresh, for phone-width web on a touch screen. Everything is
 * re-fetched (like after any change). The browser's own pull-to-reload is
 * switched off at phone width (overscroll-behavior), so this is the one.
 */
export function PullToRefresh() {
  const isPhone = useIsPhone()
  const queryClient = useQueryClient()
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const start = useRef<number | null>(null)
  const latest = useRef(0)

  useEffect(() => {
    if (!isPhone || !isTouch()) return
    const onStart = (e: TouchEvent) => {
      start.current = window.scrollY <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null
    }
    const onMove = (e: TouchEvent) => {
      if (start.current === null) return
      const dy = e.touches[0].clientY - start.current
      latest.current = dy > 0 && window.scrollY <= 0 ? Math.min(dy * 0.5, 96) : 0
      setPull(latest.current)
    }
    const onEnd = () => {
      if (start.current === null) return
      start.current = null
      const pulled = latest.current
      latest.current = 0
      setPull(0)
      if (pulled < TRIGGER) return
      setRefreshing(true)
      void queryClient.invalidateQueries().finally(() => setRefreshing(false))
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [isPhone, queryClient])

  if (!pull && !refreshing) return null
  const ready = pull >= TRIGGER
  return (
    <div className="pull-refresh" style={{ transform: `translateY(${refreshing ? TRIGGER : pull}px)` }} role="status" aria-live="polite">
      <IoRefresh className={refreshing ? 'spinning' : undefined} style={{ transform: refreshing ? undefined : `rotate(${pull * 3}deg)` }} aria-hidden />
      <span className="visually-hidden">{refreshing ? t('common.loading') : ready ? t('pull.release') : t('pull.pull')}</span>
    </div>
  )
}
