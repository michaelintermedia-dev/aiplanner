import { FEED_FILTERS, FEED_SORTS, feedGroupLabel, feedItemKey, groupFeed } from '@shared/feed'
import { activeFilterCount, feedFilterParams, NO_FILTERS, type FeedFilters } from '@shared/feedFilter'
import type { FeedItem, FeedSort } from '@shared/types'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ComponentType } from 'react'
import { IoAlbumsOutline, IoCheckmarkCircleOutline, IoClose, IoTrashOutline } from 'react-icons/io5'
import { useSearchParams } from 'react-router'
import { feedApi } from '../api/endpoints'
import { useDebounced } from '../lib/useDebounced'
import { useItemDeletion } from '../lib/useItemDeletion'
import { useAuth } from '../auth/useAuth'
import { CaptureBar } from '../components/CaptureBar'
import { FeedFilterBar } from '../components/FeedFilterBar'
import { FeedRow } from '../components/FeedRow'
import { KIND_ICON } from '../components/kindIcons'
import { UndoToast } from '../components/UndoToast'

/** ?show= values for the filters; the URL keeps the filter so Back works. */
const SHOW = ['all', 'tasks', 'events', 'notes'] as const
/** Same icons as the mobile tab bar. */
const ICONS: ComponentType[] = [IoAlbumsOutline, KIND_ICON.Task, KIND_ICON.Appointment, KIND_ICON.Note]

/**
 * Home: one continuous feed of tasks, events and notes, newest first by
 * default. The bottom bar filters it (as on mobile); rows open their details.
 * "Select" picks several rows to delete at once; a row's trash button deletes
 * just that one. Either way an Undo toast follows (same as mobile).
 */
export function FeedPage() {
  const { zone } = useAuth()
  const [params, setParams] = useSearchParams()
  const showIndex = Math.max(0, SHOW.indexOf((params.get('show') ?? 'all') as (typeof SHOW)[number]))
  const filter = FEED_FILTERS[showIndex]
  const [sort, setSort] = useState<FeedSort>('CreatedDesc')
  // One set of filters for every tab: switching tabs keeps them.
  const [filters, setFilters] = useState<FeedFilters>(NO_FILTERS)
  // Search as you type, but only ask the server once typing pauses.
  const text = useDebounced(filters.text)
  const filterParams = feedFilterParams({ ...filters, text }, zone.timeZone)
  const filtering = activeFilterCount(filters) > 0
  // null = not selecting; otherwise the picked rows by feedItemKey.
  const [selected, setSelected] = useState<Map<string, FeedItem> | null>(null)
  const deletion = useItemDeletion()

  const feed = useInfiniteQuery({
    queryKey: ['feed', filter.kinds, sort, filterParams],
    queryFn: ({ pageParam }) => feedApi.page({ kinds: filter.kinds, sort, cursor: pageParam, filters: filterParams }),
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

  const selecting = selected !== null
  useEffect(() => {
    if (!selecting) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selecting])

  const toggle = (item: FeedItem) =>
    setSelected((s) => {
      const next = new Map(s)
      const key = feedItemKey(item)
      if (next.has(key)) next.delete(key)
      else next.set(key, item)
      return next
    })
  const allSelected = selecting && items.length > 0 && selected.size === items.length

  return (
    <div className="page feed-page">
      <CaptureBar />
      {selected ? (
        <div className="selection-bar" role="toolbar" aria-label="Selected items">
          <button type="button" className="icon-button" onClick={() => setSelected(null)} aria-label="Stop selecting">
            <IoClose aria-hidden />
          </button>
          <span className="selection-count">{selected.size} selected</span>
          <button
            type="button"
            className="link"
            disabled={items.length === 0}
            onClick={() => setSelected(allSelected ? new Map() : new Map(items.map((i) => [feedItemKey(i), i])))}>
            {allSelected ? 'Select none' : 'Select all'}
          </button>
          <button
            type="button"
            className="danger-button"
            disabled={selected.size === 0 || deletion.busy}
            onClick={() => deletion.deleteItems([...selected.values()], () => setSelected(null))}>
            <IoTrashOutline aria-hidden /> Delete
          </button>
        </div>
      ) : (
        <FeedFilterBar
          filters={filters}
          onChange={setFilters}
          sortChip={
            <>
              <button type="button" className="chip filter-toggle" onClick={() => setSelected(new Map())} disabled={items.length === 0}>
                <IoCheckmarkCircleOutline aria-hidden /> Select
              </button>
              <SortChip sort={sort} onChange={setSort} />
            </>
          }
        />
      )}
      {deletion.error && <p className="error">{deletion.error.message}</p>}

      {feed.isPending && <p className="muted">Loading…</p>}
      {feed.error && <p className="error">{feed.error.message}</p>}
      {feed.data && items.length === 0 && (
        <p className="empty">
          {filtering
            ? 'Nothing matches these filters.'
            : showIndex === 0
              ? 'Nothing here yet — hold the mic or type above to capture something.'
              : `No ${filter.label.toLowerCase()} yet.`}
        </p>
      )}

      {groups.map((g) => (
        <section key={g.key} className="feed-group">
          <h2>{feedGroupLabel(g.key, zone)}</h2>
          <ul className="list">
            {g.items.map((item) => (
              <FeedRow
                key={feedItemKey(item)}
                item={item}
                selection={selected ? { selected: selected.has(feedItemKey(item)), onToggle: () => toggle(item) } : undefined}
                onDelete={() => deletion.deleteItems([item])}
              />
            ))}
          </ul>
        </section>
      ))}

      <div ref={sentinel} className="feed-end" aria-live="polite">
        {isFetchingNextPage ? 'Loading more…' : feed.data && !hasNextPage && items.length > 0 ? 'That’s everything.' : ''}
      </div>

      {deletion.deleted && <UndoToast deleted={deletion.deleted} onUndo={deletion.undo} onClose={deletion.hide} />}

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
                  setSelected(null)
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
