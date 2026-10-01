import { FEED_FILTERS, FEED_SORTS, feedGroupLabel, groupFeed } from '@shared/feed'
import type { FeedSort } from '@shared/types'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { feedApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { CaptureBar } from '../components/CaptureBar'
import { FeedRow } from '../components/FeedRow'

/** ?show= values for the filters; the URL keeps the filter so Back works. */
const SHOW = ['all', 'tasks', 'events', 'notes'] as const

/**
 * The home screen: one continuous feed of tasks, events and notes, newest
 * first by default. The tabs filter it; every row opens its detail view.
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
    <div className="page">
      <CaptureBar />

      <div className="feed-toolbar">
        <div className="segmented" role="tablist" aria-label="Show">
          {FEED_FILTERS.map((f, i) => (
            <button
              key={f.label}
              role="tab"
              aria-selected={i === showIndex}
              className={i === showIndex ? 'active' : undefined}
              onClick={() => setParams(i === 0 ? {} : { show: SHOW[i] })}>
              {f.label}
            </button>
          ))}
        </div>
        <label className="feed-sort">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as FeedSort)}>
            {FEED_SORTS.map((s) => (
              <option key={s.sort} value={s.sort}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {feed.isPending && <p className="muted">Loading…</p>}
      {feed.error && <p className="error">{feed.error.message}</p>}
      {feed.data && items.length === 0 && (
        <p className="empty">
          {showIndex === 0 ? 'Nothing here yet — type or speak above to capture something.' : `No ${filter.label.toLowerCase()} yet.`}
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
    </div>
  )
}
