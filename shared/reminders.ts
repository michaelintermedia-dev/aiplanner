import { addDays, dateKey, formatDateKey, formatTime, timeKey, todayKey, zonedToUtc, type ZoneContext } from './dates'
import type { Reminder, ReminderKind, Weekday } from './types'

/**
 * Reminder helpers shared by web and mobile: labels, the quick presets the
 * picker offers, and what's still missing before a reminder can be saved.
 */

/** Monday first, the way the calendar shows weeks. */
export const WEEKDAYS: Weekday[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** "N minutes before" choices for a dated task or an event. */
export const BEFORE_CHOICES = [0, 5, 10, 15, 30, 60, 120, 1440]

/** The kinds the picker offers, in order; "Before" only where the item has a time. */
export const REMINDER_KINDS: { kind: ReminderKind; label: string }[] = [
  { kind: 'At', label: 'Once' },
  { kind: 'Before', label: 'Before it' },
  { kind: 'Daily', label: 'Every day' },
  { kind: 'Weekdays', label: 'Weekdays' },
  { kind: 'Weekly', label: 'Weekly' },
]

export function minutesBeforeLabel(minutes: number): string {
  if (minutes === 0) return 'At the time'
  if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes === 1440 ? '' : 's'} before`
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? '' : 's'} before`
  return `${minutes} min before`
}

/** "08:00" -> "8:00 AM" (or "08:00" in 24-hour locales). */
export function formatClock(time: string, locale: string): string {
  const [h, m] = time.split(':').map(Number)
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, h, m)))
}

const shortDay = (day: Weekday, locale: string) =>
  // 2024-01-07 was a Sunday; WEEKDAYS-independent lookup by name.
  formatDateKey(addDays('2024-01-07', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(day)), locale, { weekday: 'short' })

/** One line for a reminder: "Every day at 8:00 AM", "Mon, Thu at 7:30 PM", "10 min before", "Fri, Oct 2, 9:00 AM". */
export function describeReminder(r: Reminder, zone: ZoneContext): string {
  const at = r.time ? formatClock(r.time, zone.locale) : '…'
  switch (r.kind) {
    case 'At':
      if (!r.atUtc) return 'Once - pick a time'
      return `${formatDateKey(dateKey(r.atUtc, zone.timeZone), zone.locale, { weekday: 'short', month: 'short', day: 'numeric' })}, ${formatTime(r.atUtc, zone)}`
    case 'Before':
      return minutesBeforeLabel(r.minutesBefore ?? 0)
    case 'Daily':
      return `Every day at ${at}`
    case 'Weekdays':
      return `Weekdays at ${at}`
    case 'Weekly': {
      const days = WEEKDAYS.filter((d) => r.days?.includes(d)).map((d) => shortDay(d, zone.locale))
      return `${days.length ? days.join(', ') : 'Weekly'} at ${at}`
    }
  }
}

/** One-tap choices. `itemHasTime` adds the "before" ones (dated task with a time, or an event). */
export function reminderPresets(zone: ZoneContext, itemHasTime: boolean, now = new Date()): { label: string; reminder: Reminder }[] {
  const inAnHour = new Date(Math.ceil((now.getTime() + 60 * 60 * 1000) / 60000) * 60000).toISOString()
  const tomorrow9 = zonedToUtc(addDays(todayKey(zone.timeZone), 1), '09:00', zone.timeZone)
  return [
    ...(itemHasTime
      ? [
          { label: 'At the time', reminder: { kind: 'Before', minutesBefore: 0 } as Reminder },
          { label: '10 min before', reminder: { kind: 'Before', minutesBefore: 10 } as Reminder },
          { label: '1 hour before', reminder: { kind: 'Before', minutesBefore: 60 } as Reminder },
        ]
      : []),
    { label: 'In 1 hour', reminder: { kind: 'At', atUtc: inAnHour } },
    { label: 'Tomorrow 9:00', reminder: { kind: 'At', atUtc: tomorrow9 } },
    { label: 'Every day 9:00', reminder: { kind: 'Daily', time: '09:00' } },
  ]
}

/** A sensible starting point when the user switches the kind in the editor. */
export function reminderOfKind(kind: ReminderKind, previous: Reminder | null, zone: ZoneContext): Reminder {
  const time = previous?.time ?? (previous?.atUtc ? timeKey(previous.atUtc, zone.timeZone) : '09:00')
  switch (kind) {
    case 'At':
      return { kind, atUtc: previous?.atUtc ?? zonedToUtc(addDays(todayKey(zone.timeZone), 1), time, zone.timeZone) }
    case 'Before':
      return { kind, minutesBefore: previous?.minutesBefore ?? 0 }
    case 'Weekly':
      return { kind, time, days: previous?.days?.length ? previous.days : [WEEKDAYS[(new Date().getDay() + 6) % 7]] }
    default:
      return { kind, time }
  }
}

/** What still has to be fixed before saving (null = fine). */
export function reminderProblem(r: Reminder | null, opts: { itemHasTime: boolean; isNote: boolean }): string | null {
  if (!r) return null
  switch (r.kind) {
    case 'At':
      return r.atUtc ? null : 'Pick when to remind you.'
    case 'Before':
      if (opts.isNote) return 'A note has no time of its own - pick a time for the reminder.'
      return opts.itemHasTime ? null : 'Add a time, or pick a different reminder.'
    case 'Weekly':
      if (!r.days?.length) return 'Pick at least one day for the reminder.'
      return r.time ? null : 'Pick a time for the reminder.'
    default:
      return r.time ? null : 'Pick a time for the reminder.'
  }
}

/** True for kinds that keep going off until turned off. */
export const repeats = (r: Reminder | null | undefined) => !!r && (r.kind === 'Daily' || r.kind === 'Weekdays' || r.kind === 'Weekly')
