import { FEED_FILTERS, feedGroupLabel, feedItemKey, groupFeed } from '@shared/feed'
import { activeSorts, parseSortChips, SORT_CHIPS_KEY, type SortChip } from '@shared/sortCriteria'
import { activeFilterCount, feedFilterParams, NO_FILTERS, type FeedFilters } from '@shared/feedFilter'
import type { FeedItem } from '@shared/types'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ComponentType } from 'react'
import { IoAlbums, IoAlbumsOutline, IoCheckbox, IoCheckmarkCircleOutline, IoClose, IoDocumentText, IoTime, IoTrashOutline } from 'react-icons/io5'
import { useSearchParams } from 'react-router'
import { feedApi } from '../api/endpoints'
import { useDebounced } from '../lib/useDebounced'
import { useItemDeletion } from '../lib/useItemDeletion'
import { useAuth } from '../auth/useAuth'
import { useIsPhone } from '../lib/useIsPhone'
import { CaptureBar } from '../components/CaptureBar'
import { FeedFilterBar } from '../components/FeedFilterBar'
import { FeedRow } from '../components/FeedRow'
import { KIND_ICON } from '../components/kindIcons'
import { SortChips } from '../components/SortChips'
import { UndoToast } from '../components/UndoToast'
import { t } from '@shared/i18n'

/** ?show= values for the filters; the URL keeps the filter so Back works. */
const SHOW = ['all', 'tasks', 'events', 'notes'] as const
/** Same icons as the mobile tab bar. */
const ICONS: ComponentType[] = [IoAlbumsOutline, KIND_ICON.Task, KIND_ICON.Appointment, KIND_ICON.Note]
/** The selected tab's icon: the filled one (same shapes as KIND_ICON). */
const ACTIVE_ICONS: ComponentType[] = [IoAlbums, IoCheckbox, IoTime, IoDocumentText]
const EMPTY_KEYS = ['feed.empty.all', 'feed.empty.tasks', 'feed.empty.events', 'feed.empty.notes'] as const

/**
 * Home: one continuous feed of tasks, events and notes, newest first by
 * default. The bottom bar filters it (as on mobile); rows open their details.
 * "Select" picks several rows to delete at once; a row's trash button deletes
 * just that one. Either way an Undo toast follows (same as mobile).
 */
export function FeedPage() {
  const isPhone = useIsPhone()
  const { zone } = useAuth()
  const [params, setParams] = useSearchParams()
  const showIndex = Math.max(0, SHOW.indexOf((params.get('show') ?? 'all') as (typeof SHOW)[number]))
  const filter = FEED_FILTERS[showIndex]
  // Sort criteria as coloured chips; kept in this browser.
  const [sortChips, setSortChips] = useState<SortChip[]>(() => {
    try {
      return parseSortChips(localStorage.getItem(SORT_CHIPS_KEY))
    } catch {
      return parseSortChips(null)
    }
  })
  const changeSortChips = (chips: SortChip[]) => {
    setSortChips(chips)
    try {
      localStorage.setItem(SORT_CHIPS_KEY, JSON.stringify(chips))
    } catch {
      // Storage blocked: the choice just won't survive a reload.
    }
  }
  const sort = activeSorts(sortChips)
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
      {/* Phone width: the floating dock (App) has it. */}
      {!isPhone && <CaptureBar />}
      {selected ? (
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
      ) : (
        <FeedFilterBar
          filters={filters}
          onChange={setFilters}
          sortChip={
            <button type="button" className="chip filter-toggle" onClick={() => setSelected(new Map())} disabled={items.length === 0}>
              <IoCheckmarkCircleOutline aria-hidden /> {t('select.start')}
            </button>
          }
        />
      )}
      {!selected && <SortChips chips={sortChips} onChange={changeSortChips} />}
      {deletion.error && <p className="error">{deletion.error.message}</p>}

      {feed.isPending && <p className="muted">{t('common.loading')}</p>}
      {feed.error && <p className="error">{feed.error.message}</p>}
      {feed.data && items.length === 0 && (
        <p className="empty">
          {filtering ? t('feed.noMatches') : t(EMPTY_KEYS[showIndex])}
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
                onLongPress={selected ? undefined : () => setSelected(new Map([[feedItemKey(item), item]]))}
              />
            ))}
          </ul>
        </section>
      ))}

      <div ref={sentinel} className="feed-end" aria-live="polite">
        {isFetchingNextPage ? t('feed.loadingMore') : feed.data && !hasNextPage && items.length > 0 ? t('feed.end') : ''}
      </div>

      {deletion.deleted && <UndoToast deleted={deletion.deleted} onUndo={deletion.undo} onClose={deletion.hide} />}

      <nav className="tab-bar" aria-label={t('feed.show')}>
        <div className="tab-bar-inner" role="tablist">
          {FEED_FILTERS.map((f, i) => {
            const Icon = i === showIndex ? ACTIVE_ICONS[i] : ICONS[i]
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
                <span className="tab-icon">
                  <Icon />
                </span>
                <span>{f.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
