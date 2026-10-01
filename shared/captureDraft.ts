import { addDays, dateKey, timeKey, zonedToUtc } from './dates'
import { remindersProblem } from './reminders'
import type { CaptureItem, ConfirmCaptureItem, ExtractionIntent, Reminder, TaskPriority } from './types'

/**
 * Every item can become any type in the review (user's rule); "Appointment" is
 * shown as "Event". A reminder is not a type - any of these can carry one.
 */
export const INTENT_OPTIONS: { intent: ExtractionIntent; label: string }[] = [
  { intent: 'Task', label: 'Task' },
  { intent: 'Appointment', label: 'Event' },
  { intent: 'Note', label: 'Note' },
]

/**
 * The editable form of a proposed item on the review screen (spec section 18).
 * Dates are wall-clock values in the user's timezone ("yyyy-MM-dd", "HH:mm"),
 * kept independent of the intent so switching Task <-> Appointment keeps them.
 */
export interface ItemDraft {
  id: string
  include: boolean
  intent: ExtractionIntent
  title: string
  description: string | null
  date: string | null
  time: string | null
  /** Appointment end time; null means "one hour after start". */
  endTime: string | null
  location: string | null
  priority: TaskPriority | null
  /** Any item can carry several (see Reminder). */
  reminders: Reminder[]
  clarification: string | null
}

export function toDraft(item: CaptureItem, timeZone: string): ItemDraft {
  const when = item.startUtc ?? item.dueUtc
  // "Reminder" was a type once; it's now a task that reminds at its time.
  const legacyReminder = item.intent === 'Reminder'
  return {
    id: item.id,
    include: true,
    intent: legacyReminder ? 'Task' : item.intent,
    title: item.title,
    description: item.description,
    date: when ? dateKey(when, timeZone) : null,
    time: when && item.hasTime ? timeKey(when, timeZone) : null,
    endTime: item.intent === 'Appointment' && item.endUtc ? timeKey(item.endUtc, timeZone) : null,
    location: item.location,
    priority: item.priority,
    reminders: item.reminders.length || !legacyReminder ? item.reminders : [{ kind: 'Before', minutesBefore: 0 }],
    clarification: item.clarification,
  }
}

/** Whether the item has its own time - what a "before" reminder counts back from. */
export const draftHasTime = (d: ItemDraft) => d.intent !== 'Note' && !!d.date && !!d.time

/** What still has to be filled in before this item can be saved (empty = ready). */
export function draftProblems(d: ItemDraft): string[] {
  if (!d.include) return []
  const problems: string[] = []
  if (!d.title.trim()) problems.push('Add a title.')
  if (d.intent === 'Appointment' && (!d.date || !d.time)) problems.push('An appointment needs a date and start time.')
  if (d.intent === 'Task' && d.time && !d.date) problems.push('Pick a date for this time.')
  const reminder = remindersProblem(d.reminders, { itemHasTime: draftHasTime(d), isNote: d.intent === 'Note' })
  if (reminder) problems.push(reminder)
  return problems
}

/** Converts an edited draft to the /confirm payload, turning local dates into UTC. */
export function toConfirmItem(d: ItemDraft, timeZone: string): ConfirmCaptureItem {
  const base = {
    id: d.id,
    include: d.include,
    intent: d.intent,
    title: d.title.trim(),
    description: d.description,
    startUtc: null as string | null,
    endUtc: null as string | null,
    dueUtc: null as string | null,
    hasTime: false,
    location: null as string | null,
    priority: d.priority,
    reminders: d.reminders,
  }

  if (d.intent === 'Appointment' && d.date && d.time) {
    const start = zonedToUtc(d.date, d.time, timeZone)
    let end = d.endTime ? zonedToUtc(d.date, d.endTime, timeZone) : null
    if (end && end <= start) end = zonedToUtc(addDays(d.date, 1), d.endTime, timeZone) // ends after midnight
    if (!end) end = new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString()
    return { ...base, startUtc: start, endUtc: end, hasTime: true, location: d.location }
  }

  if ((d.intent === 'Task' || d.intent === 'Reminder') && d.date) {
    return { ...base, dueUtc: zonedToUtc(d.date, d.time, timeZone), hasTime: !!d.time }
  }

  return base
}
