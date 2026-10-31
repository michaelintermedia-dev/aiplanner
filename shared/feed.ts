import { addDays, dateKey, formatDateKey, formatDue, formatTime, todayKey, type ZoneContext } from './dates'
import { t } from './i18n'
import type { FeedItem, FeedKind, FeedSection, FeedSort } from './types'

// Labels are getters, so they always read in the current language.

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
  // Searching: one list, best match first - no day headers.
  if (list[0] === 'Relevance') return 'results'
  // Smart: the item's section.
  if (list[0] === 'Smart') return `s:${item.section ?? 'NoDate'}`
  if (list[0] === 'PriorityHigh' && item.priority === 'High') return 'high'
  const instant = groupInstant(item, list.find((s) => s !== 'PriorityHigh' && s !== 'Relevance') ?? 'CreatedDesc')
  return instant ? dateKey(instant, timeZone) : 'none'
}

/** "Today", "Yesterday", "Tomorrow", "Mon, Sep 28" (+ year if not this year), or "No date". */
export function feedGroupLabel(key: string, zone: ZoneContext): string {
  if (key.startsWith('s:')) return sectionLabel(key.slice(2) as FeedSection)
  if (key === 'none') return t('date.none')
  if (key === 'high') return t('feed.group.high')
  if (key === 'results') return t('feed.group.results')
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

/**
 * The bell on a row: the item's next reminder - "Today 6:00 PM", whether it's
 * today (shown highlighted) and whether it repeats (repeat icon). Null = none coming.
 */
export function feedReminder(item: FeedItem, zone: ZoneContext): { label: string; today: boolean; repeats: boolean } | null {
  if (!item.nextReminderUtc) return null
  return {
    label: formatDue(item.nextReminderUtc, true, zone),
    today: dateKey(item.nextReminderUtc, zone.timeZone) === todayKey(zone.timeZone),
    repeats: !!item.reminderRepeats,
  }
}

/** What an untitled note is called (its first words) - e.g. in "Updates ..." when adding to it. */
export const noteName = (note: { title: string | null; content: string }) => {
  if (note.title) return note.title
  const flat = note.content.replace(/\s+/g, ' ').trim()
  return flat.length <= 80 ? flat : `${flat.slice(0, 79).trimEnd()}…`
}

/** The Smart order's section headers. */
export function sectionLabel(section: FeedSection): string {
  switch (section) {
    case 'Overdue': return t('filter.when.overdue')
    case 'Today': return t('date.today')
    case 'Upcoming': return t('filter.when.upcoming')
    case 'Notes': return t('feed.tab.notes')
    case 'Done': return t('filter.status.done')
    default: return t('date.none')
  }
}

/** An event's time badge on its row ("16:00"). */
export const eventTime = (item: FeedItem, zone: ZoneContext): string | null =>
  item.kind === 'Appointment' && item.dateUtc ? formatTime(item.dateUtc, zone) : null

export type RowIndicator =
  | { type: 'reminder'; label: string; today: boolean; repeats: boolean }
  | { type: 'date'; label: string }
  | { type: 'repeat' }
  | { type: 'text'; label: string }

/**
 * The ONE thing a feed row shows after its title (spec v2), the first that
 * applies: the next reminder (time only when it's today) -> the date when it
 * isn't today (an event's time is on its badge; a task due today at a time
 * shows that time) -> the repeat icon -> a note's first line.
 */
export function rowIndicator(item: FeedItem, zone: ZoneContext): RowIndicator | null {
  const reminder = feedReminder(item, zone)
  if (reminder) return { type: 'reminder', ...reminder, label: reminder.today ? formatTime(item.nextReminderUtc!, zone) : reminder.label }
  if (item.dateUtc) {
    const today = dateKey(item.dateUtc, zone.timeZone) === todayKey(zone.timeZone)
    if (!today) return { type: 'date', label: formatDue(item.dateUtc, item.kind === 'Task' && item.hasTime, zone) }
    if (item.kind === 'Task' && item.hasTime) return { type: 'date', label: formatTime(item.dateUtc, zone) }
  }
  if (item.repeats) return { type: 'repeat' }
  if (item.kind === 'Note' && item.snippet) return { type: 'text', label: item.snippet.split(/\r?\n/)[0] }
  return null
}
