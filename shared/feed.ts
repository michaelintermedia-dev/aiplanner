import { addDays, dateKey, formatDateKey, formatDue, formatTime, todayKey, type ZoneContext } from './dates'
import { t } from './i18n'
import type { FeedItem, FeedKind, FeedSort } from './types'

// Labels are getters, so they always read in the current language.

/** Filters offered by both apps, in display order. */
export const FEED_FILTERS: { label: string; kinds: FeedKind[] }[] = [
  { get label() { return t('feed.tab.all') }, kinds: [] },
  { get label() { return t('feed.tab.tasks') }, kinds: ['Task'] },
  { get label() { return t('feed.tab.events') }, kinds: ['Appointment'] },
  { get label() { return t('feed.tab.notes') }, kinds: ['Note'] },
]

export const FEED_SORTS: { label: string; sort: FeedSort }[] = [
  { get label() { return t('feed.sort.newest') }, sort: 'CreatedDesc' },
  { get label() { return t('feed.sort.oldest') }, sort: 'CreatedAsc' },
  { get label() { return t('feed.sort.updated') }, sort: 'UpdatedDesc' },
  { get label() { return t('feed.sort.date') }, sort: 'DateAsc' },
]

/** The types an item can be changed to, in display order (same labels as KIND_LABEL). */
export const ITEM_TYPES: FeedKind[] = ['Task', 'Appointment', 'Note']

/** What users see for each kind ("Appointment" is called "Event"). */
export const KIND_LABEL: Record<FeedKind, string> = {
  get Task() { return t('kind.task') },
  get Appointment() { return t('kind.event') },
  get Note() { return t('kind.note') },
}

/** The timestamp a feed item is grouped under for a (date) sort. */
function groupInstant(item: FeedItem, sort: FeedSort): string | null {
  if (sort === 'DateAsc') return item.dateUtc
  return sort === 'UpdatedDesc' ? item.updatedAtUtc : item.createdAtUtc
}

/**
 * Group key for an item under the active sort criteria: "high" for a
 * high-priority task when that criterion comes first, otherwise the day
 * ("yyyy-MM-dd") of the first date criterion, or "none" for undated items
 * when sorting by date.
 */
export function feedGroupKey(item: FeedItem, sorts: FeedSort | FeedSort[], timeZone: string): string {
  const list = Array.isArray(sorts) ? sorts : [sorts]
  if (list[0] === 'PriorityHigh' && item.priority === 'High') return 'high'
  const instant = groupInstant(item, list.find((s) => s !== 'PriorityHigh') ?? 'CreatedDesc')
  return instant ? dateKey(instant, timeZone) : 'none'
}

/** "Today", "Yesterday", "Tomorrow", "Mon, Sep 28" (+ year if not this year), or "No date". */
export function feedGroupLabel(key: string, zone: ZoneContext): string {
  if (key === 'none') return t('date.none')
  if (key === 'high') return t('feed.group.high')
  const today = todayKey(zone.timeZone)
  if (key === today) return t('date.today')
  if (key === addDays(today, -1)) return t('date.yesterday')
  if (key === addDays(today, 1)) return t('date.tomorrow')
  const sameYear = key.slice(0, 4) === today.slice(0, 4)
  return formatDateKey(key, zone.locale, { weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
}

/** Splits an ordered list into consecutive day groups (keeps the server's order). */
export function groupFeed(items: FeedItem[], sort: FeedSort | FeedSort[], timeZone: string): { key: string; items: FeedItem[] }[] {
  const groups: { key: string; items: FeedItem[] }[] = []
  for (const item of items) {
    const key = feedGroupKey(item, sort, timeZone)
    const last = groups[groups.length - 1]
    if (last?.key === key) last.items.push(item)
    else groups.push({ key, items: [item] })
  }
  return groups
}

/** The when-line for a row: "Today 3:00 PM", "Fri, Oct 2 4:00 PM – 5:30 PM", or null. */
export function feedWhen(item: FeedItem, zone: ZoneContext): string | null {
  if (!item.dateUtc) return null
  const start = formatDue(item.dateUtc, item.hasTime, zone)
  return item.kind === 'Appointment' && item.endUtc ? `${start} – ${formatTime(item.endUtc, zone)}` : start
}

/**
 * A scheduled event whose end (or start, without an end) is behind us. Worked
 * out from the clock, never stored, so it can't go stale. Shown like a
 * completed task (muted, struck through) with a "Passed" badge.
 */
export function eventPassed(e: { status: string | null; startUtc: string | null; endUtc: string | null }, now = Date.now()): boolean {
  const end = e.endUtc ?? e.startUtc
  return e.status === 'Scheduled' && !!end && new Date(end).getTime() < now
}

/** Feed rows use dateUtc for the start. */
export const feedItemPassed = (item: FeedItem) =>
  item.kind === 'Appointment' && eventPassed({ status: item.status, startUtc: item.dateUtc, endUtc: item.endUtc })

/** Done = completed or cancelled (shown struck through). */
export const isDone = (item: FeedItem) => item.status === 'Completed' || item.status === 'Cancelled'

/** A feed item's identity across types (ids are unique per type only). */
export const feedItemKey = (item: { kind: FeedKind; id: string }) => `${item.kind}-${item.id}`

/** "Note deleted" / "3 items deleted" - the undo toast's text. */
export const deletedLabel = (items: { kind: FeedKind }[]) =>
  items.length === 1 ? t(DELETED_KEY[items[0].kind]) : t('feed.deletedMany', { count: items.length })

const DELETED_KEY = { Task: 'feed.deleted.task', Appointment: 'feed.deleted.event', Note: 'feed.deleted.note' } as const

/** How long the undo toast stays after a delete. */
export const UNDO_MS = 8000
