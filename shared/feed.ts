import { addDays, dateKey, formatDateKey, formatDue, formatTime, todayKey, type ZoneContext } from './dates'
import type { FeedItem, FeedKind, FeedSort } from './types'

/** Filters offered by both apps, in display order. */
export const FEED_FILTERS: { label: string; kinds: FeedKind[] }[] = [
  { label: 'All', kinds: [] },
  { label: 'Tasks', kinds: ['Task'] },
  { label: 'Events', kinds: ['Appointment'] },
  { label: 'Notes', kinds: ['Note'] },
]

export const FEED_SORTS: { label: string; sort: FeedSort }[] = [
  { label: 'Newest', sort: 'CreatedDesc' },
  { label: 'Oldest', sort: 'CreatedAsc' },
  { label: 'Recently updated', sort: 'UpdatedDesc' },
  { label: 'By date', sort: 'DateAsc' },
]

/** The types an item can be changed to, in display order (same labels as KIND_LABEL). */
export const ITEM_TYPES: FeedKind[] = ['Task', 'Appointment', 'Note']

/** What users see for each kind ("Appointment" is called "Event"). */
export const KIND_LABEL: Record<FeedKind, string> = { Task: 'Task', Appointment: 'Event', Note: 'Note' }

/** The timestamp a feed item is grouped under for the current sort. */
function groupInstant(item: FeedItem, sort: FeedSort): string | null {
  if (sort === 'DateAsc') return item.dateUtc
  return sort === 'UpdatedDesc' ? item.updatedAtUtc : item.createdAtUtc
}

/** Day-group key for an item ("yyyy-MM-dd", or "none" for undated items when sorting by date). */
export function feedGroupKey(item: FeedItem, sort: FeedSort, timeZone: string): string {
  const instant = groupInstant(item, sort)
  return instant ? dateKey(instant, timeZone) : 'none'
}

/** "Today", "Yesterday", "Tomorrow", "Mon, Sep 28" (+ year if not this year), or "No date". */
export function feedGroupLabel(key: string, zone: ZoneContext): string {
  if (key === 'none') return 'No date'
  const today = todayKey(zone.timeZone)
  if (key === today) return 'Today'
  if (key === addDays(today, -1)) return 'Yesterday'
  if (key === addDays(today, 1)) return 'Tomorrow'
  const sameYear = key.slice(0, 4) === today.slice(0, 4)
  return formatDateKey(key, zone.locale, { weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
}

/** Splits an ordered list into consecutive day groups (keeps the server's order). */
export function groupFeed(items: FeedItem[], sort: FeedSort, timeZone: string): { key: string; items: FeedItem[] }[] {
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
  items.length === 1 ? `${KIND_LABEL[items[0].kind]} deleted` : `${items.length} items deleted`

/** How long the undo toast stays after a delete. */
export const UNDO_MS = 8000
