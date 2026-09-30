// Date helpers that work in the *user's* timezone (from their profile), not the
// browser's. The API stores and returns UTC; everything shown or entered in the
// UI is a wall-clock time in the user's IANA timezone (spec section 25).

export interface ZoneContext {
  timeZone: string
  locale: string
}

/** "yyyy-MM-dd" of the given instant, as a calendar date in `timeZone`. */
export function dateKey(utc: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(utc),
  )
}

export function todayKey(timeZone: string): string {
  return dateKey(new Date(), timeZone)
}

/** Adds whole days to a "yyyy-MM-dd" key (pure calendar arithmetic, no timezone). */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Offset in ms between `timeZone`'s wall clock and UTC at the given instant. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, Number(p.value)]),
  )
  const wallAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return wallAsUtc - Math.floor(instant / 1000) * 1000
}

/**
 * Converts a wall-clock date (and optional "HH:mm" time, default midnight) in
 * `timeZone` to a UTC ISO string. Re-checks the offset at the result so dates
 * on either side of a DST change resolve correctly.
 */
export function zonedToUtc(key: string, time: string | null, timeZone: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const [hh, mm] = (time ?? '00:00').split(':').map(Number)
  const wall = Date.UTC(y, m - 1, d, hh, mm)
  let utc = wall - zoneOffsetMs(wall, timeZone)
  const corrected = wall - zoneOffsetMs(utc, timeZone)
  if (corrected !== utc) utc = corrected
  return new Date(utc).toISOString()
}

export function formatTime(utc: string, { timeZone, locale }: ZoneContext): string {
  return new Intl.DateTimeFormat(locale, { timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date(utc))
}

/** Formats a "yyyy-MM-dd" key as a readable date, e.g. "Wednesday, September 30". */
export function formatDateKey(key: string, locale: string, options?: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    ...(options ?? { weekday: 'long', month: 'long', day: 'numeric' }),
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

/** Short due label: "Today 15:00", "Tomorrow", "Mon, Oct 5 09:30"... */
export function formatDue(utc: string, hasTime: boolean, zone: ZoneContext): string {
  const key = dateKey(utc, zone.timeZone)
  const today = todayKey(zone.timeZone)
  const day =
    key === today
      ? 'Today'
      : key === addDays(today, 1)
        ? 'Tomorrow'
        : key === addDays(today, -1)
          ? 'Yesterday'
          : formatDateKey(key, zone.locale, { weekday: 'short', month: 'short', day: 'numeric' })
  return hasTime ? `${day} ${formatTime(utc, zone)}` : day
}
