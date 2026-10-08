import { addDays, formatDateKey } from './dates'
import { t } from './i18n'
import type { CalendarView, Weekday } from './types'

/** Calendar period math shared by web and mobile, on "yyyy-MM-dd" keys. */

/**
 * Where weeks begin (Settings - Calendar, on the account; the API's week view
 * uses the same): Monday, Sunday or Saturday. Each app sets it from the
 * account (and its own copy at start-up) and re-renders when it changes.
 */
export const FIRST_DAYS: Weekday[] = ['Monday', 'Sunday', 'Saturday']
const SUNDAY_FIRST: Weekday[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
let firstDay: Weekday = 'Monday'

export function setFirstDayOfWeek(day: string | null | undefined) {
  firstDay = FIRST_DAYS.includes(day as Weekday) ? (day as Weekday) : 'Monday'
}
export const firstDayOfWeek = () => firstDay

/** The seven weekdays in the user's order (the day chips of reminders and repeats). */
export const weekdaysInOrder = (): Weekday[] => {
  const start = SUNDAY_FIRST.indexOf(firstDay)
  return [...SUNDAY_FIRST.slice(start), ...SUNDAY_FIRST.slice(0, start)]
}

/** The first day of the week containing `key`. */
export function weekStart(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const back = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() - SUNDAY_FIRST.indexOf(firstDay) + 7) % 7
  return addDays(key, -back)
}

/** The days a view shows around `anchor`; a month is padded to full weeks. */
export function visibleDays(view: CalendarView, anchor: string): string[] {
  if (view === 'day') return [anchor]
  if (view === 'week') return Array.from({ length: 7 }, (_, i) => addDays(weekStart(anchor), i))
  const first = `${anchor.slice(0, 7)}-01`
  const last = addDays(stepPeriod('month', first, 1), -1)
  const end = addDays(weekStart(last), 6)
  const days: string[] = []
  for (let day = weekStart(first); day <= end; day = addDays(day, 1)) days.push(day)
  return days
}

/** The anchor one period earlier/later (a month step lands on the 1st). */
export function stepPeriod(view: CalendarView, anchor: string, direction: 1 | -1): string {
  if (view === 'day') return addDays(anchor, direction)
  if (view === 'week') return addDays(anchor, 7 * direction)
  const [y, m] = anchor.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + direction, 1)).toISOString().slice(0, 10)
}

/** "October 2026", "Sep 28 – Oct 4" or the full day, depending on the view. */
export function periodTitle(view: CalendarView, anchor: string, locale: string): string {
  if (view === 'month') return formatDateKey(anchor, locale, { month: 'long', year: 'numeric' })
  if (view === 'week') {
    const days = visibleDays('week', anchor)
    const short = { month: 'short', day: 'numeric' } as const
    return `${formatDateKey(days[0], locale, short)} – ${formatDateKey(days[6], locale, short)}`
  }
  return formatDateKey(anchor, locale)
}

export const CALENDAR_VIEWS: { view: CalendarView; label: string }[] = [
  { view: 'day', get label() { return t('calendar.day') } },
  { view: 'week', get label() { return t('calendar.week') } },
  { view: 'month', get label() { return t('calendar.month') } },
]

/** A weekday's name in the user's language ("Sunday", "воскресенье"). */
export const weekdayName = (day: Weekday, locale: string) =>
  formatDateKey(addDays('2024-01-07', SUNDAY_FIRST.indexOf(day)), locale, { weekday: 'long' })
