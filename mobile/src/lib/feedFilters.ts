import { NO_FILTERS, type FeedFilters } from '@shared/feedFilter'
import { useSyncExternalStore } from 'react'

/**
 * The feed filters, shared by all the tabs (All / Tasks / Events / Notes are
 * separate screens): switching tabs keeps them, like on web.
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
