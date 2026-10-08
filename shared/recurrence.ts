import { weekdaysInOrder } from './calendar'
import { addDays, dateKey, formatDateKey, timeKey, zonedToUtc, type ZoneContext } from './dates'
import { t } from './i18n'
import { shortDay } from './reminders'
import type { Recurrence, Weekday } from './types'

/**
 * Repeating tasks and events (spec section 24) on the client: labels, the
 * picker's presets, and the same occurrence math as the server's
 * RecurrenceSchedule (keep the two the same) - for "next dates" and previews.
 * Everything runs on the user's wall clock, in their profile timezone. The
 * item's own date/time is the first occurrence.
 */

const SUNDAY_FIRST: Weekday[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const dayNumber = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 864e5
}
/** The weekday of a "yyyy-MM-dd" date. */
export const weekdayOf = (key: string): Weekday => SUNDAY_FIRST[new Date(dayNumber(key) * 864e5).getUTCDay()]
const mondayOf = (key: string) => addDays(key, -((SUNDAY_FIRST.indexOf(weekdayOf(key)) + 6) % 7))
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

function falls(r: Recurrence, first: string, day: string, days: Weekday[], monthDay: number): boolean {
  const interval = Math.max(1, r.interval || 1)
  switch (r.frequency) {
    case 'Daily':
      return (dayNumber(day) - dayNumber(first)) % interval === 0
    case 'Weekdays':
      return weekdayOf(day) !== 'Saturday' && weekdayOf(day) !== 'Sunday'
    case 'Weekly':
      return days.includes(weekdayOf(day)) && ((dayNumber(mondayOf(day)) - dayNumber(mondayOf(first))) / 7) % interval === 0
    case 'Monthly': {
      const [fy, fm] = first.split('-').map(Number)
      const [y, m, d] = day.split('-').map(Number)
      return ((y - fy) * 12 + m - fm) % interval === 0 && d === Math.min(monthDay, daysInMonth(y, m))
    }
    default:
      return false
  }
}

/**
 * Occurrence starts (UTC ISO), oldest first: those at or after `fromUtc` (if
 * given), before `toUtc` (if given), at most `max`.
 */
export function occurrences(
  r: Recurrence,
  firstUtc: string,
  timeZone: string,
  { fromUtc, toUtc, max = 50, skipped = [] }: { fromUtc?: string; toUtc?: string; max?: number; skipped?: string[] } = {},
): string[] {
  const first = dateKey(firstUtc, timeZone)
  const time = timeKey(firstUtc, timeZone)
  const days = r.frequency === 'Weekly' && r.days?.length ? r.days : [weekdayOf(first)]
  const monthDay = r.monthDay ?? Number(first.slice(8))
  const from = fromUtc ? Date.parse(fromUtc) : -Infinity
  const to = toUtc ? Date.parse(toUtc) : Infinity
  const skip = new Set(skipped.map((s) => Date.parse(s)))
  const out: string[] = []
  let count = 0
  for (let i = 0; i < 366 * 20 && out.length < max; i++) {
    const day = addDays(first, i)
    if (r.until && day > r.until) break
    if (i > 0 && !falls(r, first, day, days, monthDay)) continue
    if (r.count && count >= r.count) break
    count++
    const utc = zonedToUtc(day, time, timeZone)
    const at = Date.parse(utc)
    if (at >= to) break
    if (at >= from && !skip.has(at)) out.push(utc)
  }
  return out
}

/** "Every day", "Every 2 weeks on Mon, Thu", "Every month on day 1 · until Dec 31". */
export function describeRecurrence(r: Recurrence, zone: ZoneContext): string {
  const n = Math.max(1, r.interval || 1)
  const days = (r.days ?? []).length ? weekdaysInOrder().filter((d) => r.days!.includes(d)).map((d) => shortDay(d, zone.locale)).join(', ') : ''
  let text = ''
  switch (r.frequency) {
    case 'Daily':
      text = n === 1 ? t('repeat.daily') : t('repeat.everyNDays', { count: n })
      break
    case 'Weekdays':
      text = t('repeat.weekdays')
      break
    case 'Weekly':
      text = n === 1 ? (days ? t('repeat.weeklyOn', { days }) : t('repeat.weekly')) : t('repeat.everyNWeeksOn', { count: n, days: days || '…' })
      break
    case 'Monthly':
      text = n === 1
        ? r.monthDay ? t('repeat.monthlyOn', { day: r.monthDay }) : t('repeat.monthly')
        : t('repeat.everyNMonthsOn', { count: n, day: r.monthDay ?? '…' })
      break
  }
  if (r.until) text += ` · ${t('repeat.until', { date: formatDateKey(r.until, zone.locale, { month: 'short', day: 'numeric', year: 'numeric' }) })}`
  else if (r.count) text += ` · ${t('repeat.times', { count: r.count })}`
  return text
}

export type RepeatPreset = 'None' | 'Daily' | 'Weekdays' | 'Weekly' | 'Monthly'

/** The picker's quick choices, with the item's date filling in the day ("Every Monday", "Every month on the 5th"). */
export const REPEAT_PRESETS: RepeatPreset[] = ['None', 'Daily', 'Weekdays', 'Weekly', 'Monthly']

export function presetRule(preset: RepeatPreset, date: string | null): Recurrence | null {
  switch (preset) {
    case 'None':
      return null
    case 'Weekly':
      return { frequency: 'Weekly', interval: 1, days: date ? [weekdayOf(date)] : null }
    case 'Monthly':
      return { frequency: 'Monthly', interval: 1, monthDay: date ? Number(date.slice(8)) : null }
    default:
      return { frequency: preset, interval: 1 }
  }
}

/** Which preset a rule is (or null: a custom one - every N, other days, an end). */
export function presetOf(r: Recurrence | null | undefined, date: string | null): RepeatPreset | null {
  if (!r) return 'None'
  if ((r.interval || 1) !== 1 || r.until || r.count) return null
  if (r.frequency === 'Weekly') return !r.days?.length || (r.days.length === 1 && (!date || r.days[0] === weekdayOf(date))) ? 'Weekly' : null
  if (r.frequency === 'Monthly') return !r.monthDay || !date || r.monthDay === Number(date.slice(8)) ? 'Monthly' : null
  return r.frequency === 'Daily' || r.frequency === 'Weekdays' ? r.frequency : null
}

export const presetLabel = (p: RepeatPreset, date: string | null, zone: ZoneContext): string =>
  p === 'None' ? t('repeat.none') : describeRecurrence(presetRule(p, date)!, zone)

/** What's wrong with repeating this item (null: fine). */
export function recurrenceProblem(r: Recurrence | null | undefined, { hasDate, ongoing }: { hasDate: boolean; ongoing?: boolean }): string | null {
  if (!r) return null
  if (ongoing) return t('repeat.ongoingNo')
  if (!hasDate) return t('repeat.needsDate')
  if (r.frequency === 'Weekly' && r.days && r.days.length === 0) return t('repeat.pickDays')
  return null
}

/** Same rule? (for "did the AI change it") */
export const sameRecurrence = (a: Recurrence | null | undefined, b: Recurrence | null | undefined) =>
  JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))

const normalize = (r: Recurrence | null | undefined) =>
  r ? { f: r.frequency, i: r.interval || 1, d: [...(r.days ?? [])].sort(), m: r.monthDay ?? null, u: r.until ?? null, c: r.count ?? null } : null
