import { t } from './i18n'
import type { FeedSort } from './types'

/**
 * The feed's order (spec v2, 2026-10-31), chosen in the ⚙ sheet and kept per
 * device: Smart (sections - Overdue, Today, Upcoming, No date, Notes, Done) by
 * default, or Newest / Oldest / Recently updated; plus "High priority first"
 * (inside each section for Smart). Searching always puts the best match first.
 */
export type FeedOrder = 'Smart' | 'CreatedDesc' | 'CreatedAsc' | 'UpdatedDesc'

export interface OrderSetting {
  order: FeedOrder
  priorityFirst: boolean
}

export const DEFAULT_ORDER: OrderSetting = { order: 'Smart', priorityFirst: false }

export const ORDER_OPTIONS: { value: FeedOrder; label: string }[] = [
  { value: 'Smart', get label() { return t('feed.order.smart') } },
  { value: 'CreatedDesc', get label() { return t('feed.sort.newest') } },
  { value: 'CreatedAsc', get label() { return t('feed.sort.oldest') } },
  { value: 'UpdatedDesc', get label() { return t('feed.sort.updated') } },
]

/** Storage key (localStorage on web, SecureStore on mobile). */
export const FEED_ORDER_KEY = 'feedOrder'

/** A saved setting, checked (anything unusable -> the default). */
export function parseOrder(json: string | null | undefined): OrderSetting {
  try {
    const v = JSON.parse(json ?? '') as Partial<OrderSetting> | null
    const order = ORDER_OPTIONS.some((o) => o.value === v?.order) ? (v!.order as FeedOrder) : DEFAULT_ORDER.order
    return { order, priorityFirst: v?.priorityFirst === true }
  } catch {
    return DEFAULT_ORDER
  }
}

/** The sort criteria to ask the feed for. */
export function feedSorts(searching: boolean, o: OrderSetting): FeedSort[] {
  const base: FeedSort[] = o.priorityFirst ? (o.order === 'Smart' ? ['Smart', 'PriorityHigh'] : ['PriorityHigh', o.order]) : [o.order]
  return searching ? ['Relevance', ...base.filter((s) => s !== 'Smart')] : base
}
