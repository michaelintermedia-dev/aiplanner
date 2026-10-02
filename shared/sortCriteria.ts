import { t, type MessageKey } from './i18n'
import type { FeedSort } from './types'

/**
 * Sort criteria for the feed, shared by web and mobile. The user picks which
 * criteria to use and a colour for each; they show as round chips above the
 * feed. A chip can be switched off and on again with a tap; the feed is sorted
 * by the chips that are on, in order (the first decides, later ones break
 * ties). New criteria (e.g. "Relevant") go here + in the API's FeedSort.
 */

export interface SortChip {
  sort: FeedSort
  color: string
  on: boolean
}

/** Colours to choose from (green is kept for the "on" ring). */
export const SORT_COLORS = ['#4f5bd5', '#7048e8', '#d6336c', '#e03131', '#e8590c', '#f59f00', '#1098ad', '#8d6e63']

/** The ring around a chip that is on. */
export const SORT_ON_RING = '#2f9e44'

/** Every criterion, in the order chips are shown and applied. */
export const SORT_CRITERIA: { sort: FeedSort; color: string; labelKey: MessageKey; shortKey: MessageKey }[] = [
  { sort: 'PriorityHigh', color: '#e03131', labelKey: 'feed.sort.priority', shortKey: 'feed.sortShort.priority' },
  { sort: 'CreatedDesc', color: '#4f5bd5', labelKey: 'feed.sort.newest', shortKey: 'feed.sortShort.newest' },
  { sort: 'CreatedAsc', color: '#8d6e63', labelKey: 'feed.sort.oldest', shortKey: 'feed.sortShort.oldest' },
  { sort: 'UpdatedDesc', color: '#7048e8', labelKey: 'feed.sort.updated', shortKey: 'feed.sortShort.updated' },
  { sort: 'DateAsc', color: '#1098ad', labelKey: 'feed.sort.date', shortKey: 'feed.sortShort.date' },
]

export const sortLabel = (sort: FeedSort) => t(SORT_CRITERIA.find((c) => c.sort === sort)?.labelKey ?? 'feed.sort.newest')
export const sortShortLabel = (sort: FeedSort) => t(SORT_CRITERIA.find((c) => c.sort === sort)?.shortKey ?? 'feed.sortShort.newest')

/** Until the user picks: high-priority tasks first, then newest. */
export const DEFAULT_SORT_CHIPS: SortChip[] = [
  { sort: 'PriorityHigh', color: '#e03131', on: true },
  { sort: 'CreatedDesc', color: '#4f5bd5', on: true },
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
        !!c && SORT_CRITERIA.some((k) => k.sort === c.sort) && typeof c.color === 'string' && /^#[0-9a-f]{6}$/i.test(c.color) && typeof c.on === 'boolean',
    )
    // Keep the canonical order and drop duplicates.
    const ordered = SORT_CRITERIA.map((k) => chips.find((c) => c.sort === k.sort)).filter((c): c is SortChip => !!c)
    return ordered.length ? ordered : DEFAULT_SORT_CHIPS
  } catch {
    return DEFAULT_SORT_CHIPS
  }
}

/** Storage key for the chips (localStorage on web, SecureStore on mobile). */
export const SORT_CHIPS_KEY = 'feedSortChips'

/** "#4f5bd5" + alpha 0..1 -> "#4f5bd5aa" (works in CSS and React Native). */
export const withAlpha = (hex: string, alpha: number) =>
  hex + Math.round(alpha * 255).toString(16).padStart(2, '0')
