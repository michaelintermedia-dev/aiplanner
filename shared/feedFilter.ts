import { weekStart } from './calendar'
import { addDays, formatDateKey, todayKey, zonedToUtc } from './dates'
import { t } from './i18n'
import type { FeedKind } from './types'

/**
 * Feed filters, shared by web and mobile (spec v2, 2026-10-31): one chip row -
 * the type (All / Tasks / Events / Notes, one at a time), the toggles Open /
 * Today / With media (combinable) and ⚙ for everything else (FiltersSheet).
 * The server does the filtering (GET /feed), so paging still works.
 */

export type CreatedRange = 'any' | 'today' | '7d' | '30d' | 'custom'
export type WhenRange = 'any' | 'today' | 'week' | 'upcoming' | 'overdue' | 'nodate'
/** How an item was made: spoken, typed to the AI, or by hand. */
export type Origin = 'any' | 'voice' | 'typed' | 'manual'
/** Something the item has: a photo, a document, a web link, a place. */
export type Has = 'photo' | 'file' | 'link' | 'place' | 'media'
/** The type chips. */
export type Show = 'all' | 'tasks' | 'events' | 'notes'
export type ReminderFilter = 'Any' | 'With' | 'Repeating' | 'Without'
export type StatusFilter = 'Any' | 'Open' | 'Done'

export interface FeedFilters {
  /** The type chip that's on. */
  show: Show
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
}

export const NO_FILTERS: FeedFilters = {
  show: 'all',
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
}

/** The type chips, in order. */
export const SHOW_OPTIONS: { value: Show; kinds: FeedKind[]; label: string }[] = [
  { value: 'all', kinds: [], get label() { return t('feed.tab.all') } },
  { value: 'tasks', kinds: ['Task'], get label() { return t('feed.tab.tasks') } },
  { value: 'events', kinds: ['Appointment'], get label() { return t('feed.tab.events') } },
  { value: 'notes', kinds: ['Note'], get label() { return t('feed.tab.notes') } },
]
export const kindsOf = (show: Show): FeedKind[] => SHOW_OPTIONS.find((o) => o.value === show)?.kinds ?? []

/**
 * The toggle chips next to the type: Open (not done - notes count as open), Today
 * (today + overdue tasks) and With media (a photo or a document). Each is one
 * of the filters, so the sheet shows the same choice.
 */
export type ToggleId = 'open' | 'today' | 'media'
export const TOGGLES: { id: ToggleId; label: string; on: (f: FeedFilters) => boolean; flip: (f: FeedFilters) => FeedFilters }[] = [
  {
    id: 'open',
    get label() { return t('filter.status.open') },
    on: (f) => f.status === 'Open',
    flip: (f) => ({ ...f, status: f.status === 'Open' ? 'Any' : 'Open' }),
  },
  {
    id: 'today',
    get label() { return t('date.today') },
    on: (f) => f.when === 'today',
    flip: (f) => ({ ...f, when: f.when === 'today' ? 'any' : 'today' }),
  },
  {
    id: 'media',
    get label() { return t('filter.has.media') },
    on: (f) => f.has.includes('media'),
    flip: (f) => ({ ...f, has: f.has.includes('media') ? f.has.filter((h) => h !== 'media') : [...f.has, 'media'] }),
  },
]

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

/**
 * The filters set in the ⚙ sheet as removable chips ("Created: Last 7 days ✕") -
 * not the search text, the type or the toggles (they show on the chip row).
 */
export function filterChips(f: FeedFilters, locale: string): { key: string; label: string; clear: (f: FeedFilters) => FeedFilters }[] {
  const chips: { key: string; label: string; clear: (f: FeedFilters) => FeedFilters }[] = []
  if (f.created !== 'any') {
    const short = (key: string | null) => (key ? formatDateKey(key, locale, { month: 'short', day: 'numeric' }) : '…')
    const label = f.created === 'custom' ? `${short(f.createdFrom)} – ${short(f.createdTo)}` : labelOf(CREATED_OPTIONS, f.created)
    chips.push({ key: 'created', label: t('filter.chip.created', { value: label }), clear: (x) => ({ ...x, created: 'any', createdFrom: null, createdTo: null }) })
  }
  if (f.when !== 'any' && f.when !== 'today') chips.push({ key: 'when', label: t('filter.chip.when', { value: labelOf(WHEN_OPTIONS, f.when) }), clear: (x) => ({ ...x, when: 'any' }) })
  if (f.status !== 'Any' && f.status !== 'Open') chips.push({ key: 'status', label: labelOf(STATUS_OPTIONS, f.status), clear: (x) => ({ ...x, status: 'Any' }) })
  if (f.reminders !== 'Any') chips.push({ key: 'reminders', label: labelOf(REMINDER_OPTIONS, f.reminders), clear: (x) => ({ ...x, reminders: 'Any' }) })
  if (f.origin !== 'any') chips.push({ key: 'origin', label: labelOf(ORIGIN_OPTIONS, f.origin), clear: (x) => ({ ...x, origin: 'any' }) })
  for (const h of f.has.filter((x) => x !== 'media')) chips.push({ key: `has:${h}`, label: labelOf(HAS_OPTIONS, h), clear: (x) => ({ ...x, has: x.has.filter((y) => y !== h) }) })
  for (const tag of f.tags) chips.push({ key: `tag:${tag}`, label: `#${tag}`, clear: (x) => ({ ...x, tags: x.tags.filter((t) => t !== tag) }) })
  return chips
}

/** How many filters the ⚙ sheet has on (its badge). */
export const sheetFilterCount = (f: FeedFilters) => filterChips(f, 'en').length

/** Anything narrowing the list (for "Nothing matches" instead of "Nothing here yet"). */
export const isFiltering = (f: FeedFilters) => !!f.text.trim() || sheetFilterCount(f) > 0 || TOGGLES.some((x) => x.on(f))

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
    // Today = today's events and tasks, plus tasks still open from before.
    p.dateFrom = day(today)
    p.dateTo = day(addDays(today, 1))
    p.withOverdue = 'true'
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
  for (const h of f.has) p[h === 'photo' ? 'hasPhoto' : h === 'file' ? 'hasFile' : h === 'link' ? 'hasLink' : h === 'media' ? 'hasMedia' : 'hasPlace'] = 'true'
  if (f.tags.length) p.tags = f.tags.join(',')
  return p
}

/** "Clear all" for what the ⚙ sheet set: the type, the search and the toggle chips stay. */
export const clearSheetFilters = (f: FeedFilters): FeedFilters => ({
  ...NO_FILTERS,
  show: f.show,
  text: f.text,
  status: f.status === 'Open' ? 'Open' : 'Any',
  when: f.when === 'today' ? 'today' : 'any',
  has: f.has.filter((h) => h === 'media'),
})
