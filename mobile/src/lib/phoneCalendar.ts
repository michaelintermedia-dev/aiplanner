import { dateKey } from '@shared/dates'
import type { CalendarItem } from '@shared/types'
import * as Calendar from 'expo-calendar/legacy'
import { File, Paths } from 'expo-file-system'
import { Platform } from 'react-native'
import { authApi, calendarApi } from '@/api/endpoints'

/**
 * "Show in this phone's calendar" (2026-10-23): Samsung Calendar can't subscribe
 * to a link, and Google Calendar's phone app can't add one - so the app writes
 * the events and open dated tasks itself into a calendar called "Gatazee" on
 * the phone (a local one: no account). Every calendar app on the phone shows it.
 * Kept in step whenever the app refreshes (and by the background refresh): a
 * month back, half a year ahead. Read-only for the user in spirit - changes
 * made there are overwritten. No alarms: Gatazee does the reminding.
 * The device's event ids per entry are kept in phone-calendar.json.
 */
interface State {
  on: boolean
  calendarId: string | null
  /** Our key ("a:<event>:<start>" / "t:<task>") -> the phone's event id + what was written. */
  events: Record<string, { id: string; sig: string }>
}

const stateFile = () => new File(Paths.document, 'phone-calendar.json')
const OFF: State = { on: false, calendarId: null, events: {} }

function load(): State {
  try {
    const f = stateFile()
    return f.exists ? { ...OFF, ...(JSON.parse(f.textSync()) as State) } : OFF
  } catch {
    return OFF
  }
}

function save(state: State) {
  try {
    const f = stateFile()
    if (!f.exists) f.create()
    f.write(JSON.stringify(state))
  } catch {
    // not kept: the next sync starts over (it finds nothing to update and adds again)
  }
}

export const phoneCalendarOn = () => load().on

/** Asks for the calendar permission, makes the "Gatazee" calendar and fills it. False: not allowed. */
export async function turnOnPhoneCalendar(): Promise<boolean> {
  if ((await Calendar.requestCalendarPermissionsAsync()).status !== 'granted') return false
  const state = load()
  state.on = true
  state.calendarId = await ensureCalendar(state.calendarId)
  save(state)
  await syncPhoneCalendar()
  return true
}

/** Removes the "Gatazee" calendar from the phone, with everything in it. */
export async function turnOffPhoneCalendar() {
  const { calendarId } = load()
  save(OFF)
  if (calendarId) await Calendar.deleteCalendarAsync(calendarId).catch(() => {})
}

let running: Promise<void> | null = null

/** Brings the phone's calendar in step with the account (nothing when it's off). One at a time. */
export function syncPhoneCalendar(): Promise<void> {
  if (!load().on) return Promise.resolve()
  running ??= sync()
    .catch((e) => console.warn('Phone calendar sync failed', e))
    .finally(() => {
      running = null
    })
  return running
}

async function ensureCalendar(id: string | null): Promise<string> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)
  const existing = calendars.find((c) => c.id === id) ?? calendars.find((c) => c.title === 'Gatazee' && c.source?.isLocalAccount)
  if (existing) return existing.id
  return Calendar.createCalendarAsync({
    title: 'Gatazee',
    name: 'Gatazee',
    color: '#4f5bd5',
    entityType: Calendar.EntityTypes.EVENT,
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
    ownerAccount: 'Gatazee',
    ...(Platform.OS === 'android'
      ? { source: { isLocalAccount: true, name: 'Gatazee', type: Calendar.SourceType.LOCAL } }
      : { sourceId: (await Calendar.getDefaultCalendarAsync()).source.id }),
  })
}

interface Wanted {
  title: string
  startDate: Date
  endDate: Date
  allDay: boolean
  location: string | null
}

/** What the phone's calendar should hold: every event date, and each open task once (its due date). */
function wanted(items: CalendarItem[], timeZone: string): Map<string, Wanted> {
  const out = new Map<string, Wanted>()
  for (const i of items) {
    if (i.itemType === 'Appointment') {
      out.set(`a:${i.id}:${i.startUtc}`, {
        title: i.title, startDate: new Date(i.startUtc), endDate: new Date(i.endUtc ?? i.startUtc), allDay: false, location: i.location,
      })
    } else if (i.status !== 'Completed' && !out.has(`t:${i.id}`)) {
      // Items come oldest first, so a repeating task's first date is its current one.
      if (i.hasTime) {
        const start = new Date(i.startUtc)
        out.set(`t:${i.id}`, { title: i.title, startDate: start, endDate: new Date(start.getTime() + 30 * 60000), allDay: false, location: i.location })
      } else {
        // An all-day entry is that date at UTC midnight (Android's rule), from the account's own zone.
        const [y, m, d] = dateKey(i.startUtc, timeZone).split('-').map(Number)
        out.set(`t:${i.id}`, {
          title: i.title, startDate: new Date(Date.UTC(y, m - 1, d)), endDate: new Date(Date.UTC(y, m - 1, d + 1)), allDay: true, location: i.location,
        })
      }
    }
  }
  return out
}

async function sync() {
  if ((await Calendar.getCalendarPermissionsAsync()).status !== 'granted') return
  const state = load()
  state.calendarId = await ensureCalendar(state.calendarId)
  const now = Date.now()
  const [me, range] = await Promise.all([
    authApi.me(),
    calendarApi.range(new Date(now - 30 * 86400000).toISOString(), new Date(now + 183 * 86400000).toISOString()),
  ])
  const target = wanted(range.items, me.timeZoneId)

  const events: State['events'] = {}
  for (const [key, w] of target) {
    const sig = JSON.stringify([w.title, w.startDate.getTime(), w.endDate.getTime(), w.allDay, w.location])
    const details: Partial<Calendar.Event> = {
      title: w.title,
      startDate: w.startDate,
      endDate: w.endDate,
      allDay: w.allDay,
      location: w.location ?? undefined,
      notes: 'Gatazee',
      alarms: [],
      ...(w.allDay ? { timeZone: 'UTC' } : {}),
    }
    const known = state.events[key]
    if (known && known.sig === sig) {
      events[key] = known
      continue
    }
    if (known) {
      try {
        await Calendar.updateEventAsync(known.id, details)
        events[key] = { id: known.id, sig }
        continue
      } catch {
        // deleted on the phone meanwhile: add it again
      }
    }
    events[key] = { id: await Calendar.createEventAsync(state.calendarId, details), sig }
  }
  for (const [key, old] of Object.entries(state.events)) {
    if (!target.has(key)) await Calendar.deleteEventAsync(old.id).catch(() => {})
  }
  save({ on: true, calendarId: state.calendarId, events })
}
