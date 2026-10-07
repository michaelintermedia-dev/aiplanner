import { addDays, dateKey, timeKey, zonedToUtc } from './dates'
import { KIND_LABEL } from './feed'
import { t } from './i18n'
import { recurrenceProblem } from './recurrence'
import { remindersProblem } from './reminders'
import type { AppendTarget, Capture, CaptureItem, ConfirmCaptureItem, ExtractionIntent, ItemType, Recurrence, Reminder, TaskPriority } from './types'

/**
 * Every item can become any type in the review (user's rule); "Appointment" is
 * shown as "Event". A reminder is not a type - any of these can carry one.
 */
export const INTENT_OPTIONS: { intent: ExtractionIntent; label: string }[] = [
  { intent: 'Task', get label() { return t('kind.task') } },
  { intent: 'Appointment', get label() { return t('kind.event') } },
  { intent: 'Note', get label() { return t('kind.note') } },
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
  /** "Add to this item": this goes into the item continued from (see AppendTarget). */
  appendTo: boolean
  /**
   * The AI returned the item continued from as a whole, updated (details merged,
   * new reminder or time applied): adding to it updates every field. Otherwise
   * adding to it only appends this text to its details.
   */
  wholeItem: boolean
  /** Updating the item with a type change: use the AI's new title instead of keeping the item's. */
  useNewTitle?: boolean
  clarification: string | null
  /** How it repeats (tasks with a date, events); null: it doesn't. */
  recurrence: Recurrence | null
  /** "Add more": words that weren't about the item, and whether to capture them as a new entry after saving. */
  unrelated: string | null
  captureUnrelated: boolean
}

/** `target`: reviewing a continued capture, so "Add to this item" is available. */
export function toDraft(item: CaptureItem, timeZone: string, target?: AppendTarget): ItemDraft {
  const when = item.startUtc ?? item.dueUtc
  // "Reminder" was a type once; it's now a task that reminds at its time.
  const legacyReminder = item.intent === 'Reminder'
  const wholeItem = !!target && item.addsToCurrent
  return {
    id: item.id,
    include: true,
    // The whole updated item keeps its type - unless the user asked to change it ("make it an event").
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
    recurrence: item.recurrenceRule ?? null,
    appendTo: wholeItem,
    wholeItem,
    unrelated: target ? (item.unrelated ?? null) : null,
    captureUnrelated: true,
  }
}

/** "Add to this item" with every field: the draft is the whole updated item. */
export const updatesWholeItem = (d: ItemDraft) => d.appendTo && d.wholeItem

/** Whether the item has its own time - what a "before" reminder counts back from. */
export const draftHasTime = (d: ItemDraft) => d.intent !== 'Note' && !!d.date && !!d.time

/** What still has to be filled in before this item can be saved (empty = ready). */
export function draftProblems(d: ItemDraft): string[] {
  if (!d.include) return []
  if (d.appendTo && !d.wholeItem) return (d.description ?? d.title).trim() ? [] : [t('draft.problem.appendText')]
  const problems: string[] = []
  // Updating an item keeps its own title.
  if (!d.appendTo && !d.title.trim()) problems.push(t('draft.problem.title'))
  if (d.intent === 'Appointment' && (!d.date || !d.time)) problems.push(t('draft.problem.eventTime'))
  if (d.intent === 'Task' && d.time && !d.date) problems.push(t('draft.problem.dateForTime'))
  const reminder = remindersProblem(d.reminders, { itemHasTime: draftHasTime(d), isNote: d.intent === 'Note' })
  if (reminder) problems.push(reminder)
  const repeat = d.intent === 'Note' ? null : recurrenceProblem(d.recurrence, { hasDate: !!d.date })
  if (repeat) problems.push(repeat)
  return problems
}

/** Converts an edited draft to the /confirm payload, turning local dates into UTC. */
export function toConfirmItem(d: ItemDraft, timeZone: string, target?: AppendTarget): ConfirmCaptureItem {
  if (d.appendTo && target && d.wholeItem) {
    // The whole item after the addition, as the type chosen in the review (a
    // different one changes its type first); the server keeps its title.
    return {
      ...toConfirmItem({ ...d, appendTo: false, title: d.useNewTitle ? d.title : target.title }, timeZone),
      appendToType: target.itemType,
      appendToId: target.itemId,
      replacesItem: true,
    }
  }
  if (d.appendTo && target) {
    return {
      id: d.id,
      include: d.include,
      intent: d.intent,
      title: d.title.trim() || t('draft.addition'),
      description: d.description,
      startUtc: null,
      endUtc: null,
      dueUtc: null,
      hasTime: false,
      location: null,
      priority: null,
      reminders: [],
      appendToType: target.itemType,
      appendToId: target.itemId,
    }
  }

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
    recurrence: d.intent === 'Note' ? null : d.recurrence,
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

/** Updating an item and changing its type too: "Task" -> "Appointment", or null. */
export const typeChange = (d: ItemDraft, target?: AppendTarget) =>
  updatesWholeItem(d) && target && d.intent !== target.itemType && d.intent !== 'Reminder' ? { from: target.itemType, to: d.intent } : null

/**
 * After saving: the item an update changed the type of now has a new id -
 * this finds it in the saved capture (null if nothing moved).
 */
export function movedItem(drafts: ItemDraft[], saved: Capture, target?: AppendTarget): { itemType: ItemType; itemId: string } | null {
  const changed = drafts.find((d) => d.include && typeChange(d, target))
  const item = changed && saved.items.find((i) => i.id === changed.id)
  if (!item) return null
  if (item.resultingAppointmentId) return { itemType: 'Appointment', itemId: item.resultingAppointmentId }
  if (item.resultingNoteId) return { itemType: 'Note', itemId: item.resultingNoteId }
  if (item.resultingTaskId) return { itemType: 'Task', itemId: item.resultingTaskId }
  return null
}

/** Updating with a type change, and the AI suggested a different title: offer it. */
export const suggestedTitle = (d: ItemDraft, target?: AppendTarget) =>
  typeChange(d, target) && target && d.title.trim() && d.title.trim() !== target.title ? d.title.trim() : null

/**
 * The proposals a review shows. Adding to an item: only the one for that item
 * (the server already set aside any earlier unsaved one, this makes sure).
 */
export const reviewItems = (capture: Capture, target?: AppendTarget) =>
  capture.items.filter((i) => i.status === 'PendingReview' && (target ? i.addsToCurrent : !i.heldByEditForm))

/** After saving an "Add more" review: the words not about the item, to capture as a new entry (or null). */
export const followUpText = (drafts: ItemDraft[]) =>
  drafts.filter((d) => d.include && d.unrelated && d.captureUnrelated).map((d) => d.unrelated!.trim()).join(' ') || null

/** What a saved capture became (the first saved item) - for "Saved as Task: …" with a link. */
export function savedItem(capture: Capture): { itemType: ItemType; id: string; title: string } | null {
  for (const i of capture.items) {
    if (i.resultingTaskId) return { itemType: 'Task', id: i.resultingTaskId, title: i.title }
    if (i.resultingAppointmentId) return { itemType: 'Appointment', id: i.resultingAppointmentId, title: i.title }
    if (i.resultingNoteId) return { itemType: 'Note', id: i.resultingNoteId, title: i.title }
  }
  return null
}

/** What a finished capture says: "Saved as Task: “Buy milk”" for one item (with it, to open), else "Saved N items". */
export interface SavedNotice {
  message: string
  item: { itemType: ItemType; id: string; title: string } | null
}

export function savedNotice(capture: Capture, count: number): SavedNotice {
  const item = count === 1 ? savedItem(capture) : null
  return {
    message: item ? t('capture.savedAs', { kind: KIND_LABEL[item.itemType], title: item.title }) : t('review.saved', { count }),
    item,
  }
}
