import { NO_FILTERS, type FeedFilters } from '@shared/feedFilter'
import { useSyncExternalStore } from 'react'

/**
 * The feed filters, kept outside the page so the capture bar can set them
 * ("find ..." opens the feed filtered). Same as the mobile app's store.
 */
let current: FeedFilters = NO_FILTERS
const listeners = new Set<() => void>()

export function setFeedFilters(next: FeedFilters) {
  current = next
  listeners.forEach((l) => l())
}

export function useFeedFilters(): [FeedFilters, (f: FeedFilters) => void] {
  const filters = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
  return [filters, setFeedFilters]
}
