import { toDraft } from './captureDraft'
import type { createApi } from './endpoints'
import { addDays, dateKey, endsNextDay, timeKey, zonedToUtc } from './dates'
import { t } from './i18n'
import { remindersProblem } from './reminders'
import type { Appointment, CaptureItem, ConfirmCaptureItem, ExtractionIntent, ItemType, Note, Reminder, Task, TaskPriority } from './types'

/**
 * An item's Edit page: one form for every type, so the Type chips can switch
 * between Task / Event / Note without losing what was typed. Everything that
 * changes an item happens here (user's call, 2026-10-05) - fields, type,
 * adding by voice or text (the AI fills the fields, changed ones are marked),
 * deleting the recording - and nothing is saved until Save.
 *
 * Dates are wall-clock values in the user's timezone ("yyyy-MM-dd", "HH:mm"),
 * "" = none.
 */
export interface ItemForm {
  type: ItemType
  title: string
  /** Task due date / event day. */
  date: string
  /** Task due time / event start. */
  time: string
  endTime: string
  location: string
  /** Event participants, comma-separated. */
  people: string
  priority: TaskPriority
  ongoing: boolean
  /** Task tags, comma-separated. */
  tags: string
  reminders: Reminder[]
  /** Task/event description, note text. */
  details: string
  notes: string
}

export type FormField = keyof ItemForm

const BLANK: ItemForm = {
  type: 'Task',
  title: '',
  date: '',
  time: '',
  endTime: '',
  location: '',
  people: '',
  priority: 'None',
  ongoing: false,
  tags: '',
  reminders: [],
  details: '',
  notes: '',
}

export const formFromTask = (task: Task, tz: string): ItemForm => ({
  ...BLANK,
  type: 'Task',
  title: task.title,
  date: task.dueDateUtc ? dateKey(task.dueDateUtc, tz) : '',
  time: task.dueDateUtc && task.hasDueTime ? timeKey(task.dueDateUtc, tz) : '',
  priority: task.priority,
  ongoing: task.status === 'Ongoing',
  tags: task.tags.join(', '),
  reminders: task.reminders ?? [],
  details: task.description ?? '',
  notes: task.notes ?? '',
})

export const formFromAppointment = (a: Appointment, tz: string): ItemForm => ({
  ...BLANK,
  type: 'Appointment',
  title: a.title,
  date: dateKey(a.startUtc, tz),
  time: timeKey(a.startUtc, tz),
  endTime: timeKey(a.endUtc, tz),
  location: a.location ?? '',
  people: a.participants.map((p) => p.name).join(', '),
  reminders: a.reminders ?? [],
  details: a.description ?? '',
  notes: a.notes ?? '',
})

export const formFromNote = (n: Note): ItemForm => ({
  ...BLANK,
  type: 'Note',
  title: n.title ?? '',
  reminders: n.reminders,
  details: n.content,
})

/** Whether the item has its own time - what a "before" reminder counts back from. */
export const formHasTime = (f: ItemForm) => f.type !== 'Note' && !(f.type === 'Task' && f.ongoing) && !!f.date && !!f.time

/** What still has to be filled in before Save (empty = ready). */
export function formProblems(f: ItemForm): string[] {
  const problems: string[] = []
  if (f.type !== 'Note' && !f.title.trim()) problems.push(t('draft.problem.title'))
  if (f.type === 'Note' && !f.details.trim() && !f.title.trim()) problems.push(t('form.noteEmpty'))
  if (f.type === 'Appointment' && (!f.date || !f.time)) problems.push(t('draft.problem.eventTime'))
  if (f.type === 'Task' && !f.ongoing && f.time && !f.date) problems.push(t('draft.problem.dateForTime'))
  const reminder = remindersProblem(f.reminders, { itemHasTime: formHasTime(f), isNote: f.type === 'Note' })
  if (reminder) problems.push(reminder)
  return problems
}

/** Anything different from the saved item. */
export const formChanged = (f: ItemForm, base: ItemForm) => JSON.stringify(f) !== JSON.stringify(base)

const list = (text: string) => text.split(',').map((s) => s.trim()).filter(Boolean)

function eventTimes(f: ItemForm, tz: string) {
  const startUtc = zonedToUtc(f.date, f.time, tz)
  // No end: one hour. An end not after the start: the next day (10pm-1am).
  const endUtc = !f.endTime
    ? new Date(new Date(startUtc).getTime() + 3600e3).toISOString()
    : zonedToUtc(endsNextDay(f.time, f.endTime) ? addDays(f.date, 1) : f.date, f.endTime, tz)
  return { startUtc, endUtc }
}

const taskDue = (f: ItemForm, tz: string) => (!f.ongoing && f.date ? zonedToUtc(f.date, f.time || null, tz) : null)

type Api = ReturnType<typeof createApi>

/** A proposal from "Add by voice or text" merged into the form (saved with it, or rejected on Cancel). */
export interface MergedProposal {
  captureId: string
  item: CaptureItem
}

const INTENT: Record<ItemType, ExtractionIntent> = { Task: 'Task', Appointment: 'Appointment', Note: 'Note' }

/** A proposal as a confirm entry (its own fields - only `linkOnly`/reject use it). */
const confirmEntry = (p: MergedProposal, include: boolean): ConfirmCaptureItem => ({
  id: p.item.id,
  include,
  intent: p.item.intent,
  title: p.item.title,
  description: p.item.description,
  startUtc: p.item.startUtc,
  endUtc: p.item.endUtc,
  dueUtc: p.item.dueUtc,
  hasTime: p.item.hasTime,
  location: p.item.location,
  priority: p.item.priority,
  reminders: p.item.reminders,
})

/**
 * Save: change the type first if asked (same created date, reminders and
 * capture link), then write every field through the item's own update, then
 * record what was added by voice/text as part of the item (its words and audio
 * clip), then delete the recording if that was asked. Returns the item (a new
 * id when the type changed).
 */
export async function saveItemForm(
  api: Api,
  {
    item,
    form,
    tz,
    proposals,
    deleteRecordingOf,
  }: { item: { itemType: ItemType; id: string }; form: ItemForm; tz: string; proposals: MergedProposal[]; deleteRecordingOf?: string | null },
): Promise<{ itemType: ItemType; id: string }> {
  let { itemType, id } = item
  if (form.type !== itemType) {
    const times = form.type === 'Appointment' ? eventTimes(form, tz) : null
    const due = form.type === 'Task' ? taskDue(form, tz) : null
    const converted = await api.items.convert({
      fromType: itemType,
      id,
      toType: form.type,
      startUtc: times?.startUtc ?? null,
      endUtc: times?.endUtc ?? null,
      dueUtc: due,
      hasDueTime: form.type === 'Task' ? !!due && !!form.time : null,
    })
    ;({ itemType, id } = converted)
  }

  if (itemType === 'Task') {
    const due = taskDue(form, tz)
    await api.tasks.update(id, {
      title: form.title.trim(),
      description: form.details.trim() || null,
      notes: form.notes.trim() || null,
      dueDateUtc: due,
      hasDueTime: !!due && !!form.time,
      priority: form.priority,
      isOngoing: form.ongoing,
      reminders: form.reminders,
      tags: list(form.tags),
    })
  } else if (itemType === 'Appointment') {
    await api.appointments.update(id, {
      title: form.title.trim(),
      description: form.details.trim() || null,
      notes: form.notes.trim() || null,
      ...eventTimes(form, tz),
      location: form.location.trim() || null,
      participantNames: list(form.people),
      reminders: form.reminders,
    })
  } else {
    await api.notes.update(id, {
      title: form.title.trim() || null,
      content: form.details.trim() || form.title.trim(),
      reminders: form.reminders,
    })
  }

  // What was said or typed about it belongs to it now (its words and audio clip).
  const byCapture = new Map<string, MergedProposal[]>()
  for (const p of proposals) byCapture.set(p.captureId, [...(byCapture.get(p.captureId) ?? []), p])
  for (const [captureId, ps] of byCapture) {
    await api.captures.confirm(
      captureId,
      ps.map((p) => ({ ...confirmEntry(p, true), intent: INTENT[itemType], appendToType: itemType, appendToId: id, linkOnly: true })),
    )
  }

  if (deleteRecordingOf) await api.captures.deleteAudio(deleteRecordingOf)
  return { itemType, id }
}

/** Cancel: the proposals merged into the form are rejected, so nothing is left pending. */
export async function discardProposals(api: Api, proposals: MergedProposal[]) {
  const byCapture = new Map<string, MergedProposal[]>()
  for (const p of proposals) byCapture.set(p.captureId, [...(byCapture.get(p.captureId) ?? []), p])
  for (const [captureId, ps] of byCapture) {
    await api.captures.confirm(captureId, ps.map((p) => confirmEntry(p, false)))
  }
}

const sameReminder = (a: Reminder, b: Reminder) => JSON.stringify(a) === JSON.stringify(b)

/**
 * "Add by voice or text": the AI returns the saved item whole, updated with
 * what was said. Only what it changed compared to the saved item is applied
 * to the form - so a second addition, or the user's own edits, are kept.
 * Returns the new form and the fields that changed (to mark them).
 */
export function applyProposal(form: ItemForm, saved: ItemForm, item: CaptureItem, tz: string): { form: ItemForm; changed: FormField[] } {
  const d = toDraft(item, tz)
  const type: ItemType = d.intent === 'Appointment' ? 'Appointment' : d.intent === 'Note' ? 'Note' : 'Task'
  const proposed = {
    type,
    date: d.date ?? '',
    time: d.time ?? '',
    endTime: type === 'Appointment' ? (d.endTime ?? '') : saved.endTime,
    location: type === 'Appointment' ? (d.location ?? '') : saved.location,
    priority: type === 'Task' ? (d.priority ?? 'None') : saved.priority,
  }
  const next: ItemForm = { ...form }
  const changed: FormField[] = []
  const set = <K extends FormField>(key: K, value: ItemForm[K]) => {
    if (JSON.stringify(next[key]) === JSON.stringify(value)) return
    next[key] = value
    changed.push(key)
  }

  for (const key of ['type', 'date', 'time', 'endTime', 'location', 'priority'] as const) {
    // A note has no date: becoming one doesn't clear the form's (switching back keeps it).
    if (type === 'Note' && (key === 'date' || key === 'time' || key === 'endTime')) continue
    if (proposed[key] !== saved[key]) set(key, proposed[key] as never)
  }

  // Details: the saved text plus what was added - add only the new part.
  const text = (d.description ?? '').trim()
  const added = text.startsWith(saved.details.trim()) ? text.slice(saved.details.trim().length).trim() : text
  if (added && !next.details.includes(added)) {
    set('details', next.details.trim() === saved.details.trim() && !text.startsWith(saved.details.trim()) ? text : join(next.details, added))
  }

  // Reminders: add the new ones, remove the ones it dropped.
  const removed = saved.reminders.filter((r) => !d.reminders.some((p) => sameReminder(p, r)))
  const fresh = d.reminders.filter((p) => !saved.reminders.some((r) => sameReminder(p, r)))
  const reminders = [...next.reminders.filter((r) => !removed.some((x) => sameReminder(x, r))), ...fresh.filter((p) => !next.reminders.some((r) => sameReminder(p, r)))]
  if (JSON.stringify(reminders) !== JSON.stringify(next.reminders)) set('reminders', reminders)

  return { form: next, changed }
}

const join = (existing: string, addition: string) => (existing.trim() ? `${existing.trimEnd()}\n\n${addition.trim()}` : addition.trim())

/**
 * The Type chips. Everything typed is kept; a note has no time of its own, so
 * its "before" reminders become one-off reminders at the same moment (or are
 * dropped when the item has no time to count back from).
 */
export function switchType(f: ItemForm, type: ItemType, tz: string): ItemForm {
  if (type !== 'Note' || !f.reminders.some((r) => r.kind === 'Before')) return { ...f, type }
  const at = formHasTime(f) ? new Date(zonedToUtc(f.date, f.time, tz)).getTime() : null
  return {
    ...f,
    type,
    reminders: f.reminders.flatMap((r): Reminder[] =>
      r.kind !== 'Before' ? [r] : at === null ? [] : [{ kind: 'At', atUtc: new Date(at - (r.minutesBefore ?? 0) * 60e3).toISOString() }],
    ),
  }
}
