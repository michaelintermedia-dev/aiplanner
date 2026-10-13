import { weekStart } from './calendar'
import { addDays, formatDateKey, todayKey, zonedToUtc } from './dates'
import { t } from './i18n'
import type { CaptureSearch, FeedSort } from './types'

/**
 * Feed filters, shared by web and mobile. One set of filters applies to
 * whichever tab is showing (All / Tasks / Events / Notes) and stays when the
 * tab changes. The server does the filtering (GET /feed), so paging still works.
 */

export type CreatedRange = 'any' | 'today' | '7d' | '30d' | 'custom'
export type WhenRange = 'any' | 'today' | 'week' | 'upcoming' | 'overdue' | 'nodate'
/** How an item was made: spoken, typed to the AI, or by hand. */
export type Origin = 'any' | 'voice' | 'typed' | 'manual'
/** Something the item has: a photo, a document, a web link, a place. */
export type Has = 'photo' | 'file' | 'link' | 'place'
export type ReminderFilter = 'Any' | 'With' | 'Repeating' | 'Without'
export type StatusFilter = 'Any' | 'Open' | 'Done'

export interface FeedFilters {
  /** Words in titles, details, note text, location and tags. */
  text: string
  created: CreatedRange
  /** Custom created range, "yyyy-MM-dd", both ends inclusive. */
  createdFrom: string | null
  createdTo: string | null
  reminders: ReminderFilter
  status: StatusFilter
  /** Task due date / event start. */
  when: WhenRange
  origin: Origin
  /** All of these (photo AND a place...). */
  has: Has[]
  /** Any of these, on any kind of item. */
  tags: string[]
  /** A quick view's own order (Upcoming: by date) - wins over the sort chips while set. */
  sort: FeedSort[] | null
  /** The quick view these filters came from (its chip shows on); null once changed by hand. */
  view: string | null
}

export const NO_FILTERS: FeedFilters = {
  text: '',
  created: 'any',
  createdFrom: null,
  createdTo: null,
  reminders: 'Any',
  status: 'Any',
  when: 'any',
  origin: 'any',
  has: [],
  tags: [],
  sort: null,
  view: null,
}

export const CREATED_OPTIONS: { value: CreatedRange; label: string }[] = [
  { value: 'any', get label() { return t('filter.created.any') } },
  { value: 'today', get label() { return t('date.today') } },
  { value: '7d', get label() { return t('filter.created.7d') } },
  { value: '30d', get label() { return t('filter.created.30d') } },
  { value: 'custom', get label() { return t('filter.created.custom') } },
]

export const WHEN_OPTIONS: { value: WhenRange; label: string }[] = [
  { value: 'any', get label() { return t('filter.any') } },
  { value: 'today', get label() { return t('date.today') } },
  { value: 'week', get label() { return t('filter.when.week') } },
  { value: 'upcoming', get label() { return t('filter.when.upcoming') } },
  { value: 'overdue', get label() { return t('filter.when.overdue') } },
  { value: 'nodate', get label() { return t('date.none') } },
]

export const REMINDER_OPTIONS: { value: ReminderFilter; label: string }[] = [
  { value: 'Any', get label() { return t('filter.any') } },
  { value: 'With', get label() { return t('filter.reminders.with') } },
  { value: 'Repeating', get label() { return t('filter.reminders.repeating') } },
  { value: 'Without', get label() { return t('filter.reminders.without') } },
]

export const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'Any', get label() { return t('filter.any') } },
  { value: 'Open', get label() { return t('filter.status.open') } },
  { value: 'Done', get label() { return t('filter.status.done') } },
]

export const ORIGIN_OPTIONS: { value: Origin; label: string }[] = [
  { value: 'any', get label() { return t('filter.origin.any') } },
  { value: 'voice', get label() { return t('filter.origin.voice') } },
  { value: 'typed', get label() { return t('filter.origin.typed') } },
  { value: 'manual', get label() { return t('filter.origin.manual') } },
]

export const HAS_OPTIONS: { value: Has; label: string }[] = [
  { value: 'photo', get label() { return t('filter.has.photo') } },
  { value: 'file', get label() { return t('filter.has.file') } },
  { value: 'link', get label() { return t('filter.has.link') } },
  { value: 'place', get label() { return t('filter.has.place') } },
]

/** Tags the filter panel shows at first: the most used, plus any picked. */
export const FILTER_TAGS_SHOWN = 8
export function filterTagsShown<T extends { name: string; count: number }>(tags: T[], picked: string[], all: boolean): T[] {
  const used = tags.filter((tag) => tag.count > 0 || picked.includes(tag.name))
  return all ? used : used.filter((tag, i) => i < FILTER_TAGS_SHOWN || picked.includes(tag.name))
}

const labelOf = <T extends string>(options: { value: T; label: string }[], value: T) => options.find((o) => o.value === value)?.label ?? value

/** The active filters as removable chips ("Created: Last 7 days ✕"). */
export function filterChips(f: FeedFilters, locale: string): { key: string; label: string; clear: (f: FeedFilters) => FeedFilters }[] {
  const chips: { key: string; label: string; clear: (f: FeedFilters) => FeedFilters }[] = []
  if (f.text.trim()) chips.push({ key: 'text', label: `“${f.text.trim()}”`, clear: (x) => ({ ...x, text: '', view: null }) })
  if (f.created !== 'any') {
    const short = (key: string | null) => (key ? formatDateKey(key, locale, { month: 'short', day: 'numeric' }) : '…')
    const label = f.created === 'custom' ? `${short(f.createdFrom)} – ${short(f.createdTo)}` : labelOf(CREATED_OPTIONS, f.created)
    chips.push({ key: 'created', label: t('filter.chip.created', { value: label }), clear: (x) => ({ ...x, created: 'any', createdFrom: null, createdTo: null, view: null }) })
  }
  if (f.when !== 'any') chips.push({ key: 'when', label: t('filter.chip.when', { value: labelOf(WHEN_OPTIONS, f.when) }), clear: (x) => ({ ...x, when: 'any', view: null }) })
  if (f.status !== 'Any') chips.push({ key: 'status', label: labelOf(STATUS_OPTIONS, f.status), clear: (x) => ({ ...x, status: 'Any', view: null }) })
  if (f.reminders !== 'Any') chips.push({ key: 'reminders', label: labelOf(REMINDER_OPTIONS, f.reminders), clear: (x) => ({ ...x, reminders: 'Any', view: null }) })
  if (f.origin !== 'any') chips.push({ key: 'origin', label: labelOf(ORIGIN_OPTIONS, f.origin), clear: (x) => ({ ...x, origin: 'any', view: null }) })
  for (const h of f.has) chips.push({ key: `has:${h}`, label: labelOf(HAS_OPTIONS, h), clear: (x) => ({ ...x, has: x.has.filter((y) => y !== h), view: null }) })
  for (const tag of f.tags) chips.push({ key: `tag:${tag}`, label: `#${tag}`, clear: (x) => ({ ...x, tags: x.tags.filter((t) => t !== tag) }) })
  return chips
}

export const activeFilterCount = (f: FeedFilters) => filterChips(f, 'en').length

/** Now, to the minute - so the parameters (a query key) don't change on every render. */
const currentMinute = () => new Date(Math.floor(Date.now() / 60_000) * 60_000)

/**
 * The /feed query parameters for these filters. Day ranges ("today", "last 7
 * days", "this week") are the user's local days, sent as UTC instants.
 */
export function feedFilterParams(f: FeedFilters, timeZone: string, now = currentMinute()): Record<string, string> {
  const p: Record<string, string> = {}
  const day = (key: string) => zonedToUtc(key, null, timeZone)
  const today = todayKey(timeZone)

  if (f.text.trim()) p.q = f.text.trim()

  const created: [string, string] | null =
    f.created === 'today' ? [today, today]
    : f.created === '7d' ? [addDays(today, -6), today]
    : f.created === '30d' ? [addDays(today, -29), today]
    : f.created === 'custom' && (f.createdFrom || f.createdTo) ? [f.createdFrom ?? '2000-01-01', f.createdTo ?? today]
    : null
  if (created) {
    p.createdFrom = day(created[0])
    p.createdTo = day(addDays(created[1], 1)) // inclusive end day
  }

  if (f.when === 'today') {
    p.dateFrom = day(today)
    p.dateTo = day(addDays(today, 1))
  } else if (f.when === 'week') {
    const monday = weekStart(today)
    p.dateFrom = day(monday)
    p.dateTo = day(addDays(monday, 7))
  } else if (f.when === 'upcoming') {
    p.dateFrom = now.toISOString()
  } else if (f.when === 'overdue') {
    p.dateTo = now.toISOString()
  } else if (f.when === 'nodate') {
    p.noDate = 'true'
  }

  // "Overdue" means not done yet.
  const status = f.when === 'overdue' && f.status === 'Any' ? 'Open' : f.status
  if (status !== 'Any') p.status = status
  if (f.reminders !== 'Any') p.reminders = f.reminders
  if (f.origin !== 'any') p.origin = f.origin === 'voice' ? 'Voice' : f.origin === 'typed' ? 'Typed' : 'Manual'
  for (const h of f.has) p[h === 'photo' ? 'hasPhoto' : h === 'file' ? 'hasFile' : h === 'link' ? 'hasLink' : 'hasPlace'] = 'true'
  if (f.tags.length) p.tags = f.tags.join(',')
  return p
}

/**
 * "Find ..." said or typed in the capture bar: the filters to show, and the
 * tab - one kind asked for opens its tab, otherwise All.
 */
export function searchFilters(search: CaptureSearch): { filters: FeedFilters; show: 'all' | 'tasks' | 'events' | 'notes' } {
  const filters: FeedFilters = {
    ...NO_FILTERS,
    text: search.text ?? '',
    tags: search.tags,
    when: search.when ?? 'any',
    status: search.status ?? 'Any',
    reminders: search.reminders ?? 'Any',
    origin: search.fromVoice ? 'voice' : 'any',
  }
  const one = search.kinds.length === 1 ? search.kinds[0] : null
  return { filters, show: one === 'Task' ? 'tasks' : one === 'Appointment' ? 'events' : one === 'Note' ? 'notes' : 'all' }
}
