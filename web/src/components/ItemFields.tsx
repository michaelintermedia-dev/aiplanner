import { endsNextDay } from '@shared/dates'
import { KIND_LABEL } from '@shared/feed'
import { t } from '@shared/i18n'
import { formHasTime, type FormField, type ItemForm } from '@shared/itemForm'
import { priorityLabel } from '@shared/labels'
import type { ItemType, TaskPriority } from '@shared/types'
import type { ReactNode } from 'react'
import { KIND_ICON } from './kindIcons'
import { ReminderList } from './ReminderList'
import { RecurrencePicker } from './RecurrencePicker'
import { TagPicker } from './TagPicker'

const TYPES: ItemType[] = ['Task', 'Appointment', 'Note']

/**
 * An item's fields, as the Edit page shows them - shared by the Edit page and
 * the review of a new entry (user's call, 2026-10-09: the review IS the Edit
 * form), so the two never drift apart. `changed`: fields the AI just filled in.
 */
export function ItemFields({
  form,
  set,
  setType,
  changed,
  afterType,
}: {
  form: ItemForm
  set: (patch: Partial<ItemForm>) => void
  /** The Type chips (switchType keeps what was typed). */
  setType: (type: ItemType) => void
  changed: FormField[]
  /** Shown right under the Type chips (the Edit page's "Changes it from Task to Event"). */
  afterType?: ReactNode
}) {
  const mark = (key: FormField) => (changed.includes(key) ? ' changed' : '')
  const isNote = form.type === 'Note'
  return (
    <>
      <div className={`intent-chips${mark('type')}`} role="radiogroup" aria-label={t('changeType.label')}>
        {TYPES.map((type) => {
          const Icon = KIND_ICON[type]
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={form.type === type}
              className={`intent-chip intent-${type.toLowerCase()}${form.type === type ? ' selected' : ''}`}
              onClick={() => setType(type)}>
              <Icon aria-hidden /> {KIND_LABEL[type]}
            </button>
          )
        })}
      </div>
      {afterType}

      <Field label={isNote ? <>{t('item.title')} <span className="muted">{t('item.optional')}</span></> : t('item.title')} changed={mark('title')}>
        <input value={form.title} onChange={(e) => set({ title: e.target.value })} required={!isNote} />
      </Field>

      {form.type === 'Task' && (
        <>
          <div className="form-row">
            <Field label={t('task.dueDate')} changed={mark('date')}>
              <input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} disabled={form.ongoing} />
            </Field>
            <Field label={t('item.time')} changed={mark('time')}>
              <input type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} disabled={form.ongoing || !form.date} />
            </Field>
          </div>
          <label className="inline-check">
            <input type="checkbox" checked={form.ongoing} onChange={(e) => set({ ongoing: e.target.checked })} />
            {t('task.ongoingCheck')}
          </label>
        </>
      )}

      {form.type === 'Appointment' && (
        <>
          <div className="form-row">
            <Field label={t('item.date')} changed={mark('date')}>
              <input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} required />
            </Field>
            <Field label={t('event.start')} changed={mark('time')}>
              <input type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} required />
            </Field>
            <Field label={t('event.end')} changed={mark('endTime')}>
              <input type="time" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} />
              {endsNextDay(form.time, form.endTime) && <span className="hint warn">{t('event.endsNextDay')}</span>}
            </Field>
          </div>
        </>
      )}

      {/* Every type has the same attributes (user's call, 2026-10-09): priority, place, people. */}
      <Field label={t('task.priority')} changed={mark('priority')}>
        <select value={form.priority} onChange={(e) => set({ priority: e.target.value as TaskPriority })}>
          {['None', 'Low', 'Medium', 'High'].map((p) => (
            <option key={p} value={p}>
              {priorityLabel(p)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('event.location')} changed={mark('location')}>
        <input value={form.location} onChange={(e) => set({ location: e.target.value })} />
      </Field>
      <Field label={<>{t('event.with')} <span className="muted">{t('item.commaSeparated')}</span></>} changed={mark('people')}>
        <input value={form.people} onChange={(e) => set({ people: e.target.value })} />
      </Field>

      {form.type !== 'Note' && (
        <div className={`field${mark('recurrence')}`} title={changed.includes('recurrence') ? t('form.changedByAi') : undefined}>
          <RecurrencePicker
            value={form.recurrence}
            onChange={(recurrence) => set({ recurrence })}
            date={form.date || null}
            disabled={form.type === 'Task' && form.ongoing}
          />
        </div>
      )}

      <div className={`field${mark('reminders')}`}>
        <span>{t('item.reminder')}</span>
        <ReminderList value={form.reminders} onChange={(reminders) => set({ reminders })} itemHasTime={formHasTime(form)} isNote={isNote} />
      </div>

      <TagPicker value={form.tags} onChange={(tags) => set({ tags })} changed={!!mark('tags')} />

      {/* One text field for every type (the old separate "Notes" joined it). */}
      <Field label={isNote ? t('kind.note') : t('item.description')} changed={mark('details')}>
        <textarea rows={isNote ? 6 : 4} value={form.details} onChange={(e) => set({ details: e.target.value })} />
      </Field>
    </>
  )
}

/** A labelled field; `changed` marks one the AI just filled in. */
export function Field({ label, changed, children }: { label: ReactNode; changed: string; children: ReactNode }) {
  return (
    <label className={changed ? 'changed' : undefined} title={changed ? t('form.changedByAi') : undefined}>
      <span>{label}</span>
      {children}
    </label>
  )
}
