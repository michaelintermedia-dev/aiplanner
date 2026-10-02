import { t, type MessageKey } from './i18n'
import type { FeedSort } from './types'

/**
 * Sort criteria for the feed, shared by web and mobile. The user picks which
 * criteria to use; they show as round chips (one icon each) above the feed.
 * A chip can be switched off and on again with a tap; the feed is sorted by
 * the chips that are on, in order (the first decides, later ones break
 * ties). New criteria (e.g. "Relevant") go here + in the API's FeedSort.
 */

export interface SortChip {
  sort: FeedSort
  on: boolean
}

/** Every criterion, in the order chips are shown and applied. */
export const SORT_CRITERIA: { sort: FeedSort; labelKey: MessageKey; shortKey: MessageKey }[] = [
  { sort: 'PriorityHigh', labelKey: 'feed.sort.priority', shortKey: 'feed.sortShort.priority' },
  { sort: 'CreatedDesc', labelKey: 'feed.sort.newest', shortKey: 'feed.sortShort.newest' },
  { sort: 'CreatedAsc', labelKey: 'feed.sort.oldest', shortKey: 'feed.sortShort.oldest' },
  { sort: 'UpdatedDesc', labelKey: 'feed.sort.updated', shortKey: 'feed.sortShort.updated' },
  { sort: 'DateAsc', labelKey: 'feed.sort.date', shortKey: 'feed.sortShort.date' },
]

export const sortLabel = (sort: FeedSort) => t(SORT_CRITERIA.find((c) => c.sort === sort)?.labelKey ?? 'feed.sort.newest')
export const sortShortLabel = (sort: FeedSort) => t(SORT_CRITERIA.find((c) => c.sort === sort)?.shortKey ?? 'feed.sortShort.newest')

/** Until the user picks: high-priority tasks first, then newest. */
export const DEFAULT_SORT_CHIPS: SortChip[] = [
  { sort: 'PriorityHigh', on: true },
  { sort: 'CreatedDesc', on: true },
]

/** What the feed is sorted by: the chips that are on, in order (none = newest first). */
export const activeSorts = (chips: SortChip[]): FeedSort[] => {
  const on = chips.filter((c) => c.on).map((c) => c.sort)
  return on.length ? on : ['CreatedDesc']
}

/** Saved chips, checked (anything unusable -> the defaults). */
export function parseSortChips(json: string | null | undefined): SortChip[] {
  try {
    const value: unknown = JSON.parse(json ?? '')
    if (!Array.isArray(value)) return DEFAULT_SORT_CHIPS
    const chips = value.filter(
      (c): c is SortChip =>
        !!c && SORT_CRITERIA.some((k) => k.sort === c.sort) && typeof c.on === 'boolean',
    )
    // Keep the canonical order and drop duplicates.
    const ordered = SORT_CRITERIA.map((k) => chips.find((c) => c.sort === k.sort))
      .filter((c): c is SortChip => !!c)
      .map(({ sort, on }) => ({ sort, on }))
    return ordered.length ? ordered : DEFAULT_SORT_CHIPS
  } catch {
    return DEFAULT_SORT_CHIPS
  }
}

/** Storage key for the chips (localStorage on web, SecureStore on mobile). */
export const SORT_CHIPS_KEY = 'feedSortChips'

