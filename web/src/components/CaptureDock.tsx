import { t } from '@shared/i18n'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { IoClose, IoMic } from 'react-icons/io5'
import { Link, useLocation } from 'react-router'
import type { SavedNotice } from '@shared/captureDraft'
import { itemPath } from '../lib/itemPath'
import { useIsPhone } from '../lib/useIsPhone'
import { CaptureBar } from './CaptureBar'

/** The bubble's size and its distance from the screen edge. */
const FAB = 56
const EDGE = 12
/** The feed's bottom filter bar (the mobile app's tab bar). */
const TAB_BAR = 57
const GAP = 12
const POSITION_KEY = 'dock-bubble'
/** How long "Saved as ..." stays up after the dock folds away. */
const NOTICE_MS = 5000

/** An item's page has its own mic next to Edit: the dock steps aside there. */
const isItemPage = (path: string) => /^\/(tasks|appointments|notes)\/[^/]+/.test(path)

/**
 * Phone-width web: the new-entry controls float over every page, like the
 * mobile app's CaptureDock (keep the two the same). Open by default; the X or a
 * touch anywhere behind it collapses it into a round mic you can drag anywhere
 * (it snaps to the nearest side); a tap opens it again, growing out of the
 * button. It never collapses or hides while recording, sending or reviewing,
 * and it stays mounted, so a recording keeps going while you move around and
 * typed text survives. It steps aside on an item's page (that page has its own
 * mic) and lifts above the on-screen keyboard. Desktop keeps the inline bar.
 */
export function CaptureDock() {
  const isPhone = useIsPhone()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(true)
  const [engaged, setEngaged] = useState(false)
  const keyboard = useKeyboardHeight()
  const panel = useRef<HTMLDivElement>(null)
  const dock = useRef<HTMLDivElement>(null)
  const [bubble, setBubble] = useState(loadBubble)
  // How far the toolbar's centre is from the bubble's, measured when it collapses.
  const [shift, setShift] = useState({ x: 0, y: 0 })

  const hidden = isItemPage(pathname) && !engaged
  const bottom = GAP + Math.max(keyboard, pathname === '/feed' ? TAB_BAR : 0)

  const collapse = useCallback(() => {
    if (!open || engaged) return
    const box = panel.current?.getBoundingClientRect()
    if (box) setShift({ x: bubble.x + FAB / 2 - (box.left + box.width / 2), y: bubble.y + FAB / 2 - (box.top + box.height / 2) })
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    setOpen(false)
  }, [open, engaged, bubble])

  // A capture is done (saved or cancelled): fold into the bubble once the bar is
  // idle again, and say what it was saved as for a moment (with Open). Same as the app.
  const [notice, setNotice] = useState<SavedNotice | null>(null)
  const foldWhenIdle = useRef(false)
  const finished = useCallback((saved: SavedNotice | null) => {
    foldWhenIdle.current = true
    setNotice(saved)
  }, [])
  useEffect(() => {
    if (engaged || !foldWhenIdle.current) return
    foldWhenIdle.current = false
    queueMicrotask(collapse)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- when the bar becomes idle
  }, [engaged])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  // A touch anywhere behind it collapses it (the touch still does its own thing).
  useEffect(() => {
    if (!isPhone || !open) return
    const onDown = (e: globalThis.PointerEvent) => {
      if (!dock.current?.contains(e.target as Node)) collapse()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [isPhone, open, collapse])

  if (!isPhone) return null

  const panelStyle: CSSProperties = open
    ? { bottom }
    : { bottom, transform: `translate(${shift.x}px, ${shift.y}px) scale(0.15)`, opacity: 0, visibility: 'hidden', pointerEvents: 'none' }

  return (
    <div ref={dock} className={`dock${hidden ? ' dock-hidden' : ''}`}>
      {notice && !open && (
        <div className="dock-notice" style={{ bottom }} role="status">
          <span>{notice.message}</span>
          {notice.item && (
            <Link to={itemPath(notice.item)} onClick={() => setNotice(null)}>
              {t('capture.open')}
            </Link>
          )}
        </div>
      )}
      <div ref={panel} className="dock-panel" style={panelStyle} aria-hidden={!open}>
        <CaptureBar onEngagedChange={setEngaged} onFinished={finished} />
        {!engaged && (
          <button type="button" className="dock-close" onClick={collapse} aria-label={t('dock.hide')}>
            <IoClose aria-hidden />
          </button>
        )}
      </div>
      <Bubble
        at={bubble}
        shown={!open}
        onMove={(at) => {
          setBubble(at)
          try {
            localStorage.setItem(POSITION_KEY, JSON.stringify(at))
          } catch {
            // not kept
          }
        }}
        onOpen={() => setOpen(true)}
      />
    </div>
  )
}

function loadBubble() {
  try {
    const saved = JSON.parse(localStorage.getItem(POSITION_KEY) ?? 'null') as { x: number; y: number } | null
    if (saved) return clampToScreen(saved)
  } catch {
    // default below
  }
  return { x: window.innerWidth - FAB - EDGE, y: window.innerHeight - FAB - TAB_BAR - GAP * 2 }
}

function clampToScreen({ x, y }: { x: number; y: number }) {
  return {
    x: x + FAB / 2 < window.innerWidth / 2 ? EDGE : window.innerWidth - FAB - EDGE,
    y: Math.min(Math.max(y, 64 + EDGE), window.innerHeight - FAB - EDGE),
  }
}

/** The collapsed toolbar: a mic you can drag anywhere; it snaps to the nearest side. A tap opens the toolbar. */
function Bubble({
  at,
  shown,
  onMove,
  onOpen,
}: {
  at: { x: number; y: number }
  shown: boolean
  onMove: (at: { x: number; y: number }) => void
  onOpen: () => void
}) {
  const drag = useRef<{ startX: number; startY: number; moved: boolean } | null>(null)
  const [live, setLive] = useState<{ x: number; y: number } | null>(null)

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startX: e.clientX, startY: e.clientY, moved: false }
  }
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true
    if (d.moved) setLive({ x: at.x + dx, y: at.y + dy })
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (!d.moved || !live) {
      setLive(null)
      onOpen() // a tap, not a drag
      return
    }
    onMove(clampToScreen(live))
    setLive(null)
  }

  const pos = live ?? at
  return (
    <button
      type="button"
      className={`dock-bubble${shown ? ' shown' : ''}${live ? ' dragging' : ''}`}
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => {
        drag.current = null
        setLive(null)
      }}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
      tabIndex={shown ? 0 : -1}
      aria-hidden={!shown}
      aria-label={t('dock.newEntry')}
      title={t('dock.dragHint')}>
      <IoMic aria-hidden />
    </button>
  )
}

/** How much of the page the on-screen keyboard covers (0 when it's down). */
function useKeyboardHeight() {
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setHeight(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return height
}
