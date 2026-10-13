import type { FeedFilters } from './feedFilter'
import { NO_FILTERS } from './feedFilter'
import { t, type MessageKey } from './i18n'
import type { FeedSort } from './types'

/**
 * Quick views (filters strategy, 2026-10-13): one tap sets the filters AND the
 * order for a common question - "what's today", "what's coming", "what did I
 * say". Tapping the active one clears it. Same row on the web and in the app;
 * each app picks an icon per id.
 */
export type QuickViewId = 'today' | 'upcoming' | 'overdue' | 'openTasks' | 'done' | 'photos' | 'voice' | 'changed'

export interface QuickView {
  id: QuickViewId
  labelKey: MessageKey
  /** The tab it opens, when it's about one kind. */
  show?: 'tasks'
  filters: Partial<FeedFilters>
  sort?: FeedSort[]
}

export const QUICK_VIEWS: QuickView[] = [
  { id: 'today', labelKey: 'date.today', filters: { when: 'today' }, sort: ['DateAsc'] },
  { id: 'upcoming', labelKey: 'view.upcoming', filters: { when: 'upcoming' }, sort: ['DateAsc'] },
  { id: 'overdue', labelKey: 'filter.when.overdue', filters: { when: 'overdue' }, sort: ['DateAsc'] },
  { id: 'openTasks', labelKey: 'view.openTasks', show: 'tasks', filters: { status: 'Open' }, sort: ['PriorityHigh', 'DateAsc'] },
  { id: 'done', labelKey: 'filter.status.done', filters: { status: 'Done' }, sort: ['UpdatedDesc'] },
  { id: 'photos', labelKey: 'view.photos', filters: { has: ['photo'] } },
  { id: 'voice', labelKey: 'view.voice', filters: { origin: 'voice' } },
  { id: 'changed', labelKey: 'view.changed', filters: {}, sort: ['UpdatedDesc'] },
]

export const viewLabel = (v: QuickView) => t(v.labelKey)

/** The filters for a quick view (the search text stays), or none when it's the one already on. */
export function toggleView(current: FeedFilters, view: QuickView): FeedFilters {
  if (current.view === view.id) return { ...NO_FILTERS, text: current.text }
  return { ...NO_FILTERS, text: current.text, ...view.filters, sort: view.sort ?? null, view: view.id }
}

/**
 * The order the feed asks for: searching puts the best match first; a quick
 * view's own order wins over the sort chips; otherwise the chips.
 */
export function feedSorts(filters: FeedFilters, chips: FeedSort[]): FeedSort[] {
  const base = filters.sort ?? chips
  return filters.text.trim() ? ['Relevance', ...base.filter((s) => s !== 'Relevance')] : base
}
