import { feedGroupLabel, feedItemKey, groupFeed } from '@shared/feed'
import { feedFilterParams, isFiltering, kindsOf } from '@shared/feedFilter'
import { feedSorts } from '@shared/feedOrder'
import { searchWords } from '@shared/highlight'
import { t } from '@shared/i18n'
import type { FeedItem } from '@shared/types'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { IoChevronDown, IoChevronForward, IoClose, IoTrashOutline } from 'react-icons/io5'
import { feedApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { CaptureBar } from '../components/CaptureBar'
import { FeedChipBar } from '../components/FeedChipBar'
import { FeedRow } from '../components/FeedRow'
import { UndoToast } from '../components/UndoToast'
import { useFeedFilters } from '../lib/feedFilters'
import { useFeedOrder } from '../lib/feedOrder'
import { useDebounced } from '../lib/useDebounced'
import { useIsPhone } from '../lib/useIsPhone'
import { useItemDeletion } from '../lib/useItemDeletion'

const EMPTY_KEYS = { all: 'feed.empty.all', tasks: 'feed.empty.tasks', events: 'feed.empty.events', notes: 'feed.empty.notes' } as const

/**
 * Home: one list of tasks, events and notes (spec v2). Smart order by default -
 * Overdue, Today, Upcoming, No date, Notes, then Done folded away - or the
 * order picked in ⚙. The chip row above narrows it; rows open their details.
 * Long-press (or "Select" in ⚙) picks several rows to delete; a row's trash
 * button deletes just that one. Either way an Undo toast follows (same as mobile).
 */
export function FeedPage() {
  const isPhone = useIsPhone()
  const { zone } = useAuth()
  // One set of filters (kept while moving around the app); the order is kept in this browser.
  const [filters, setFilters] = useFeedFilters()
  const [order, setOrder] = useFeedOrder()
  // Search as you type, but only ask the server once typing pauses.
  const text = useDebounced(filters.text)
  const sort = feedSorts(!!text.trim(), order)
  const smart = sort[0] === 'Smart'
  const kinds = kindsOf(filters.show)
  const filterParams = feedFilterParams({ ...filters, text }, zone.timeZone)
  const words = searchWords(text)
  // Done stays folded until asked for.
  const [showDone, setShowDone] = useState(false)
  // null = not selecting; otherwise the picked rows by feedItemKey.
  const [selected, setSelected] = useState<Map<string, FeedItem> | null>(null)
  const deletion = useItemDeletion()

  const feed = useInfiniteQuery({
    queryKey: ['feed', kinds, sort, filterParams],
    queryFn: ({ pageParam }) => feedApi.page({ kinds, sort, cursor: pageParam, filters: filterParams }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  })

  const items = feed.data?.pages.flatMap((p) => p.items) ?? []
  const counts = feed.data?.pages[0]?.sections ?? null
  // Folded Done: no need to load its pages.
  const doneFolded = smart && !showDone && items[items.length - 1]?.section === 'Done'
  const groups = groupFeed(items, sort, zone.timeZone)

  // Load the next page when the sentinel below the list scrolls into view.
  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed
  const canLoad = hasNextPage && !doneFolded
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && canLoad && !isFetchingNextPage) void fetchNextPage()
    }, { rootMargin: '400px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [canLoad, isFetchingNextPage, fetchNextPage])

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
      {/* Phone width: the floating dock (App) has it. */}
      {!isPhone && <CaptureBar />}
      {/* Selecting lays its bar over the chips (they keep their place, dimmed), so nothing shifts. */}
      {selected && (
        <div className="selection-bar" role="toolbar" aria-label={t('select.bar')}>
          <button type="button" className="icon-button" onClick={() => setSelected(null)} aria-label={t('select.stop')}>
            <IoClose aria-hidden />
          </button>
          <span className="selection-count">{t('select.count', { count: selected.size })}</span>
          <button
            type="button"
            className="link"
            disabled={items.length === 0}
            onClick={() => setSelected(allSelected ? new Map() : new Map(items.map((i) => [feedItemKey(i), i])))}>
            {allSelected ? t('select.none') : t('select.all')}
          </button>
          <button
            type="button"
            className="danger-button"
            disabled={selected.size === 0 || deletion.busy}
            onClick={() => deletion.deleteItems([...selected.values()], () => setSelected(null))}>
            <IoTrashOutline aria-hidden /> {t('common.delete')}
          </button>
        </div>
      )}
      <div className={`feed-controls${selected ? ' inert' : ''}`} inert={selected ? true : undefined}>
        <FeedChipBar
          filters={filters}
          onChange={setFilters}
          order={order}
          onOrder={setOrder}
          onSelect={() => setSelected(new Map())}
          canSelect={items.length > 0}
        />
      </div>
      {deletion.error && <p className="error">{deletion.error.message}</p>}

      {feed.isPending && <p className="muted">{t('common.loading')}</p>}
      {feed.error && <p className="error">{feed.error.message}</p>}
      {feed.data && items.length === 0 && <p className="empty">{isFiltering(filters) ? t('feed.noMatches') : t(EMPTY_KEYS[filters.show])}</p>}

      {groups.map((g) => {
        const isDone = g.key === 's:Done'
        const folded = isDone && !showDone
        const label = feedGroupLabel(g.key, zone)
        return (
          <section key={g.key} className={`feed-group${isDone ? ' done-group' : ''}`}>
            {isDone ? (
              <h2>
                <button type="button" className="group-toggle" aria-expanded={!folded} onClick={() => setShowDone((s) => !s)} title={folded ? t('feed.showDone') : t('feed.hideDone')}>
                  {folded ? <IoChevronForward className="flip-rtl" aria-hidden /> : <IoChevronDown aria-hidden />} {label} ({counts?.Done ?? g.items.length})
                </button>
              </h2>
            ) : (
              <h2>{label}</h2>
            )}
            {!folded && (
              <ul className="list">
                {g.items.map((item) => (
                  <FeedRow
                    key={feedItemKey(item)}
                    item={item}
                    words={words}
                    selection={selected ? { selected: selected.has(feedItemKey(item)), onToggle: () => toggle(item) } : undefined}
                    onDelete={() => deletion.deleteItems([item])}
                    onLongPress={selected ? undefined : () => setSelected(new Map([[feedItemKey(item), item]]))}
                  />
                ))}
              </ul>
            )}
          </section>
        )
      })}

      <div ref={sentinel} className="feed-end" aria-live="polite">
        {isFetchingNextPage ? t('feed.loadingMore') : feed.data && !hasNextPage && items.length > 0 && !doneFolded ? t('feed.end') : ''}
      </div>

      {deletion.deleted && <UndoToast deleted={deletion.deleted} onUndo={deletion.undo} onClose={deletion.hide} />}
    </div>
  )
}
