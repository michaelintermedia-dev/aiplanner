import { useEffect, useRef, useState, type TouchEvent } from 'react'

/**
 * Swipe sideways to go to the next / previous period (the calendar, user's
 * request 2026-10-31; the app does the same): finger to the left = next (to
 * the right in right-to-left languages, like the arrows). Mostly-vertical
 * moves stay scrolls. On a computer the ← → keys do it too.
 * `slide` names the way the new content comes in (for the CSS animation).
 */
export function useSwipeNav(onSwipe: (direction: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const latest = useRef(onSwipe)
  latest.current = onSwipe
  const [slide, setSlide] = useState<{ from: 'next' | 'prev'; n: number }>({ from: 'next', n: 0 })

  const go = (direction: 1 | -1) => {
    setSlide((s) => ({ from: direction === 1 ? 'next' : 'prev', n: s.n + 1 }))
    latest.current(direction)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (e.altKey || e.ctrlKey || e.metaKey || el?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const rtl = document.documentElement.dir === 'rtl'
      go((e.key === 'ArrowRight') !== rtl ? 1 : -1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go reads the latest callback
  }, [])

  const handlers = {
    onTouchStart: (e: TouchEvent) => {
      const t = e.touches[0]
      start.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null
    },
    onTouchEnd: (e: TouchEvent) => {
      const s = start.current
      start.current = null
      const t = e.changedTouches[0]
      if (!s || !t) return
      const dx = t.clientX - s.x
      const dy = t.clientY - s.y
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
      const rtl = document.documentElement.dir === 'rtl'
      go((dx < 0) !== rtl ? 1 : -1)
    },
  }
  return { handlers, slide }
}
