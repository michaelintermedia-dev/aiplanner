import { useRef, type MouseEvent, type PointerEvent } from 'react'

/** How long a finger stays down before it counts as a long-press (same feel as the mobile app). */
const LONG_PRESS_MS = 500

/**
 * Long-press on a touch screen (the mobile app's long-press on a feed row):
 * spread the handlers on the element. The click that ends a long-press is
 * swallowed, so a row's link doesn't open as well.
 */
export function useLongPress(onLongPress?: () => void) {
  const timer = useRef<number | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    start.current = null
  }
  if (!onLongPress) return {}
  return {
    onPointerDown: (e: PointerEvent) => {
      fired.current = false
      if (e.pointerType !== 'touch') return
      start.current = { x: e.clientX, y: e.clientY }
      timer.current = window.setTimeout(() => {
        fired.current = true
        timer.current = null
        navigator.vibrate?.(10)
        // The click that ends this press may land on another row (the page shifts
        // as select mode starts): swallow it wherever it lands.
        const swallow = (ev: Event) => {
          ev.preventDefault()
          ev.stopPropagation()
        }
        document.addEventListener('click', swallow, { capture: true, once: true })
        window.setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 800)
        onLongPress()
      }, LONG_PRESS_MS)
    },
    onPointerMove: (e: PointerEvent) => {
      // A scroll, not a press.
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear()
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onContextMenu: (e: MouseEvent) => {
      if (fired.current || timer.current !== null) e.preventDefault()
    },
    onClickCapture: (e: MouseEvent) => {
      if (!fired.current) return
      fired.current = false
      e.preventDefault()
      e.stopPropagation()
    },
  }
}
