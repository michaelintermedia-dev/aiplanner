import { FEED_FILTERS, FEED_SORTS, feedGroupLabel, groupFeed } from '@shared/feed'
import type { FeedSort } from '@shared/types'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ComponentType } from 'react'
import { IoAlbumsOutline } from 'react-icons/io5'
import { useSearchParams } from 'react-router'
import { feedApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { CaptureBar } from '../components/CaptureBar'
import { FeedRow } from '../components/FeedRow'
import { KIND_ICON } from '../components/kindIcons'

/** ?show= values for the filters; the URL keeps the filter so Back works. */
const SHOW = ['all', 'tasks', 'events', 'notes'] as const
/** Same icons as the mobile tab bar. */
const ICONS: ComponentType[] = [IoAlbumsOutline, KIND_ICON.Task, KIND_ICON.Appointment, KIND_ICON.Note]

/**
 * Home: one continuous feed of tasks, events and notes, newest first by
 * default. The bottom bar filters it (as on mobile); rows open their details.
 */
export function FeedPage() {
  const { zone } = useAuth()
  const [params, setParams] = useSearchParams()
  const showIndex = Math.max(0, SHOW.indexOf((params.get('show') ?? 'all') as (typeof SHOW)[number]))
  const filter = FEED_FILTERS[showIndex]
  const [sort, setSort] = useState<FeedSort>('CreatedDesc')

  const feed = useInfiniteQuery({
    queryKey: ['feed', filter.kinds, sort],
    queryFn: ({ pageParam }) => feedApi.page({ kinds: filter.kinds, sort, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  })

  // Load the next page when the sentinel below the list scrolls into view.
  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) void fetchNextPage()
    }, { rootMargin: '400px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const items = feed.data?.pages.flatMap((p) => p.items) ?? []
  const groups = groupFeed(items, sort, zone.timeZone)

  return (
    <div className="page feed-page">
      <CaptureBar />
      <SortChip sort={sort} onChange={setSort} />

      {feed.isPending && <p className="muted">Loading…</p>}
      {feed.error && <p className="error">{feed.error.message}</p>}
      {feed.data && items.length === 0 && (
        <p className="empty">
          {showIndex === 0 ? 'Nothing here yet — hold the mic or type above to capture something.' : `No ${filter.label.toLowerCase()} yet.`}
        </p>
      )}

      {groups.map((g) => (
        <section key={g.key} className="feed-group">
          <h2>{feedGroupLabel(g.key, zone)}</h2>
          <ul className="list">
            {g.items.map((item) => (
              <FeedRow key={`${item.kind}-${item.id}`} item={item} />
            ))}
          </ul>
        </section>
      ))}

      <div ref={sentinel} className="feed-end" aria-live="polite">
        {isFetchingNextPage ? 'Loading more…' : feed.data && !hasNextPage && items.length > 0 ? 'That’s everything.' : ''}
      </div>

      <nav className="tab-bar" aria-label="Show">
        <div className="tab-bar-inner" role="tablist">
          {FEED_FILTERS.map((f, i) => {
            const Icon = ICONS[i]
            return (
              <button
                key={f.label}
                role="tab"
                aria-selected={i === showIndex}
                className={i === showIndex ? 'active' : undefined}
                onClick={() => {
                  setParams(i === 0 ? {} : { show: SHOW[i] })
                  window.scrollTo({ top: 0 })
                }}>
                <Icon />
                <span>{f.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

/** "⇅ Newest" chip with a small menu - same control as on mobile. */
function SortChip({ sort, onChange }: { sort: FeedSort; onChange: (s: FeedSort) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const label = FEED_SORTS.find((s) => s.sort === sort)?.label ?? 'Newest'

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
    <div className="menu-anchor sort-chip-anchor" ref={ref}>
      <button className="chip" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={`Sort: ${label}. Change sort`}>
        ⇅ {label}
      </button>
      {open && (
        <div className="menu" role="menu">
          <span className="muted">Sort by</span>
          {FEED_SORTS.map((s) => (
            <button
              key={s.sort}
              role="menuitemradio"
              aria-checked={s.sort === sort}
              className={`menu-item${s.sort === sort ? ' selected' : ''}`}
              onClick={() => {
                onChange(s.sort)
                setOpen(false)
              }}>
              {s.sort === sort ? '✓ ' : ''}
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
