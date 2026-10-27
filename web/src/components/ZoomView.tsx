import { useEffect, useRef, useState, type ReactNode } from 'react'

const MAX = 5
const DOUBLE = 2.5

interface View {
  scale: number
  x: number
  y: number
}

const FIT: View = { scale: 1, x: 0, y: 0 }

/**
 * A full-screen picture you can zoom (2026-10-27, user's request; same as the
 * app's ZoomableImage): mouse wheel or a two-finger pinch zooms at that spot,
 * double-click/tap zooms in there (again to fit), dragging moves it while
 * zoomed. A single click/tap is passed on (the viewer hides its controls).
 * `resetKey` (the picture's id) starts each picture fitted.
 */
export function ZoomView({ children, resetKey, onZoomChange, onTap }: {
  children: ReactNode
  resetKey: string
  onZoomChange: (zoomed: boolean) => void
  onTap: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>(FIT)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ startView: View; startDist: number; startMid: { x: number; y: number }; moved: boolean } | null>(null)
  const lastTap = useRef(0)
  const tapTimer = useRef<number | undefined>(undefined)

  useEffect(() => setView(FIT), [resetKey])
  useEffect(() => onZoomChange(view.scale > 1), [view.scale > 1]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Keeps the zoomed picture over the screen (no empty edges dragged in). */
  const clamp = (v: View): View => {
    const r = box.current?.getBoundingClientRect()
    if (!r || v.scale <= 1) return FIT
    const limitX = (r.width * (v.scale - 1)) / 2
    const limitY = (r.height * (v.scale - 1)) / 2
    return { scale: v.scale, x: Math.max(-limitX, Math.min(limitX, v.x)), y: Math.max(-limitY, Math.min(limitY, v.y)) }
  }
  /** Zoom to `scale` keeping the point (clientX/Y) under the finger/cursor still. */
  const zoomAt = (from: View, scale: number, cx: number, cy: number): View => {
    const r = box.current!.getBoundingClientRect()
    const s = Math.max(1, Math.min(MAX, scale))
    const px = cx - (r.left + r.width / 2)
    const py = cy - (r.top + r.height / 2)
    const k = s / from.scale
    return clamp({ scale: s, x: px - (px - from.x) * k, y: py - (py - from.y) * k })
  }

  const onWheel = (e: React.WheelEvent) => {
    e.stopPropagation()
    setView((v) => zoomAt(v, v.scale * Math.exp(-e.deltaY / 300), e.clientX, e.clientY))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    const mid = pts.length === 2 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : { x: e.clientX, y: e.clientY }
    const dist = pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0
    gesture.current = { startView: view, startDist: dist, startMid: mid, moved: gesture.current?.moved ?? false }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    const pts = [...pointers.current.values()]
    if (pts.length === 2 && g.startDist > 0) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      g.moved = true
      setView(zoomAt(g.startView, g.startView.scale * (dist / g.startDist), g.startMid.x, g.startMid.y))
    } else if (pts.length === 1) {
      const dx = e.clientX - g.startMid.x
      const dy = e.clientY - g.startMid.y
      if (Math.hypot(dx, dy) > 6) g.moved = true
      if (g.startView.scale > 1) setView(clamp({ ...g.startView, x: g.startView.x + dx, y: g.startView.y + dy }))
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    e.stopPropagation()
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (pointers.current.size > 0) {
      // One finger left after a pinch: carry on dragging from here.
      const [p] = [...pointers.current.values()]
      gesture.current = { startView: view, startDist: 0, startMid: p, moved: true }
      return
    }
    gesture.current = null
    if (!g || g.moved) return
    // A tap: two quick ones zoom, one alone is passed on (after the double-tap window).
    const now = Date.now()
    if (now - lastTap.current < 300) {
      lastTap.current = 0
      window.clearTimeout(tapTimer.current)
      setView((v) => (v.scale > 1 ? FIT : zoomAt(v, DOUBLE, e.clientX, e.clientY)))
    } else {
      lastTap.current = now
      tapTimer.current = window.setTimeout(onTap, 300)
    }
  }

  return (
    <div
      ref={box}
      className={`zoom-view${view.scale > 1 ? ' zoomed' : ''}`}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => e.stopPropagation()}>
      <div className="zoom-content" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
        {children}
      </div>
    </div>
  )
}
