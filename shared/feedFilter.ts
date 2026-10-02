import { weekStart } from './calendar'
import { addDays, formatDateKey, todayKey, zonedToUtc } from './dates'
import { t } from './i18n'

/**
 * Feed filters, shared by web and mobile. One set of filters applies to
 * whichever tab is showing (All / Tasks / Events / Notes) and stays when the
 * tab changes. The server does the filtering (GET /feed), so paging still works.
 */

export type CreatedRange = 'any' | 'today' | '7d' | '30d' | 'custom'
export type WhenRange = 'any' | 'today' | 'week' | 'overdue' | 'nodate'
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
  fromVoice: boolean
  /** Any of these (only tasks have tags). */
  tags: string[]
}

export const NO_FILTERS: FeedFilters = {
  text: '',
  created: 'any',
  createdFrom: null,
  createdTo: null,
  reminders: 'Any',
  status: 'Any',
  when: 'any',
  fromVoice: false,
  tags: [],
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

const labelOf = <T extends string>(options: { value: T; label: string }[], value: T) => options.find((o) => o.value === value)?.label ?? value

/** The active filters as removable chips ("Created: Last 7 days ✕"). */
export function filterChips(f: FeedFilters, locale: string): { key: string; label: string; clear: (f: FeedFilters) => FeedFilters }[] {
  const chips: { key: string; label: string; clear: (f: FeedFilters) => FeedFilters }[] = []
  if (f.text.trim()) chips.push({ key: 'text', label: `“${f.text.trim()}”`, clear: (x) => ({ ...x, text: '' }) })
  if (f.created !== 'any') {
    const short = (key: string | null) => (key ? formatDateKey(key, locale, { month: 'short', day: 'numeric' }) : '…')
    const label = f.created === 'custom' ? `${short(f.createdFrom)} – ${short(f.createdTo)}` : labelOf(CREATED_OPTIONS, f.created)
    chips.push({ key: 'created', label: t('filter.chip.created', { value: label }), clear: (x) => ({ ...x, created: 'any', createdFrom: null, createdTo: null }) })
  }
  if (f.when !== 'any') chips.push({ key: 'when', label: t('filter.chip.when', { value: labelOf(WHEN_OPTIONS, f.when) }), clear: (x) => ({ ...x, when: 'any' }) })
  if (f.status !== 'Any') chips.push({ key: 'status', label: labelOf(STATUS_OPTIONS, f.status), clear: (x) => ({ ...x, status: 'Any' }) })
  if (f.reminders !== 'Any') chips.push({ key: 'reminders', label: labelOf(REMINDER_OPTIONS, f.reminders), clear: (x) => ({ ...x, reminders: 'Any' }) })
  if (f.fromVoice) chips.push({ key: 'voice', label: t('filter.fromVoice'), clear: (x) => ({ ...x, fromVoice: false }) })
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
  } else if (f.when === 'overdue') {
    p.dateTo = now.toISOString()
  } else if (f.when === 'nodate') {
    p.noDate = 'true'
  }

  // "Overdue" means not done yet.
  const status = f.when === 'overdue' && f.status === 'Any' ? 'Open' : f.status
  if (status !== 'Any') p.status = status
  if (f.reminders !== 'Any') p.reminders = f.reminders
  if (f.fromVoice) p.fromVoice = 'true'
  if (f.tags.length) p.tags = f.tags.join(',')
  return p
}
