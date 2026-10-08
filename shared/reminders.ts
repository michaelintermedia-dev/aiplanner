import { weekdaysInOrder } from './calendar'
import { addDays, dateKey, formatDateKey, formatTime, timeKey, todayKey, zonedToUtc, type ZoneContext } from './dates'
import { t } from './i18n'
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
  { kind: 'At', get label() { return t('reminder.kind.at') } },
  { kind: 'Before', get label() { return t('reminder.kind.before') } },
  { kind: 'Daily', get label() { return t('reminder.kind.daily') } },
  { kind: 'Weekdays', get label() { return t('reminder.kind.weekdays') } },
  { kind: 'Weekly', get label() { return t('reminder.kind.weekly') } },
]

export function minutesBeforeLabel(minutes: number): string {
  if (minutes === 0) return t('reminder.atTheTime')
  if (minutes % 1440 === 0) return t('reminder.daysBefore', { count: minutes / 1440 })
  if (minutes % 60 === 0) return t('reminder.hoursBefore', { count: minutes / 60 })
  return t('reminder.minutesBefore', { count: minutes })
}

/** "08:00" -> "8:00 AM" (or "08:00" in 24-hour locales). */
export function formatClock(time: string, locale: string): string {
  const [h, m] = time.split(':').map(Number)
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, h, m)))
}

/** "Mon" / "Пн" / "יום ב׳" - a weekday's short name in the user's language. */
export const shortDay = (day: Weekday, locale: string) =>
  // 2024-01-07 was a Sunday; WEEKDAYS-independent lookup by name.
  formatDateKey(addDays('2024-01-07', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(day)), locale, { weekday: 'short' })

/** One line for a reminder: "Every day at 8:00 AM", "Mon, Thu at 7:30 PM", "10 min before", "Fri, Oct 2, 9:00 AM". */
export function describeReminder(r: Reminder, zone: ZoneContext): string {
  const at = r.time ? formatClock(r.time, zone.locale) : '…'
  switch (r.kind) {
    case 'At':
      if (!r.atUtc) return t('reminder.oncePickTime')
      return `${formatDateKey(dateKey(r.atUtc, zone.timeZone), zone.locale, { weekday: 'short', month: 'short', day: 'numeric' })}, ${formatTime(r.atUtc, zone)}`
    case 'Before':
      return minutesBeforeLabel(r.minutesBefore ?? 0)
    case 'Daily':
      return t('reminder.dailyAt', { time: at })
    case 'Weekdays':
      return t('reminder.weekdaysAt', { time: at })
    case 'Weekly': {
      const days = weekdaysInOrder().filter((d) => r.days?.includes(d)).map((d) => shortDay(d, zone.locale))
      return t('reminder.daysAt', { days: days.length ? days.join(', ') : t('reminder.kind.weekly'), time: at })
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
          { label: t('reminder.atTheTime'), reminder: { kind: 'Before', minutesBefore: 0 } as Reminder },
          { label: t('reminder.minutesBefore', { count: 10 }), reminder: { kind: 'Before', minutesBefore: 10 } as Reminder },
          { label: t('reminder.hoursBefore', { count: 1 }), reminder: { kind: 'Before', minutesBefore: 60 } as Reminder },
        ]
      : []),
    { label: t('reminder.preset.inAnHour'), reminder: { kind: 'At', atUtc: inAnHour } },
    { label: t('reminder.preset.tomorrow9', { time: formatClock('09:00', zone.locale) }), reminder: { kind: 'At', atUtc: tomorrow9 } },
    { label: t('reminder.preset.daily9', { time: formatClock('09:00', zone.locale) }), reminder: { kind: 'Daily', time: '09:00' } },
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
      return r.atUtc ? null : t('reminder.problem.pickWhen')
    case 'Before':
      if (opts.isNote) return t('reminder.problem.noteHasNoTime')
      return opts.itemHasTime ? null : t('reminder.problem.addTime')
    case 'Weekly':
      if (!r.days?.length) return t('reminder.problem.pickDay')
      return r.time ? null : t('reminder.problem.pickTime')
    default:
      return r.time ? null : t('reminder.problem.pickTime')
  }
}

/** The first problem among an item's reminders (null = all fine). */
export function remindersProblem(list: Reminder[], opts: { itemHasTime: boolean; isNote: boolean }): string | null {
  for (const r of list) {
    const problem = reminderProblem(r, opts)
    if (problem) return problem
  }
  return null
}

/** True for kinds that keep going off until turned off. */
export const repeats = (r: Reminder | null | undefined) => !!r && (r.kind === 'Daily' || r.kind === 'Weekdays' || r.kind === 'Weekly')
