import { itemClips } from '@shared/audioSnippet'
import { reviewItems } from '@shared/captureDraft'
import { endsNextDay } from '@shared/dates'
import { KIND_LABEL } from '@shared/feed'
import { t } from '@shared/i18n'
import {
  applyProposal,
  discardProposals,
  formChanged,
  formHasTime,
  formProblems,
  saveItemForm,
  switchType,
  type FormField,
  type ItemForm,
  type MergedProposal,
} from '@shared/itemForm'
import { priorityLabel } from '@shared/labels'
import type { AppendTarget, Capture, ItemType, TaskPriority } from '@shared/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IoMicOutline, IoSparkles } from 'react-icons/io5'
import { api, capturesApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { CaptureBar } from './CaptureBar'
import { KIND_ICON } from './kindIcons'
import { ReminderList } from './ReminderList'
import { RecordingPlayer } from './SourceCapture'

const TYPES: ItemType[] = ['Task', 'Appointment', 'Note']

/** What the form keeps on this device while editing (leaving and coming back restores it). */
interface Draft {
  saved: ItemForm
  form: ItemForm
  changed: FormField[]
  proposals: MergedProposal[]
  unrelated: { text: string; capture: boolean }[]
  deleteRecording: boolean
}

const draftKey = (id: string) => `item-edit:${id}`
function loadDraft(id: string, saved: ItemForm): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(id))
    const draft = raw ? (JSON.parse(raw) as Draft) : null
    // Only if the item hasn't changed since (another device, another tab).
    return draft && JSON.stringify(draft.saved) === JSON.stringify(saved) ? draft : null
  } catch {
    return null
  }
}
function storeDraft(id: string, draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(draftKey(id), JSON.stringify(draft))
    else localStorage.removeItem(draftKey(id))
  } catch {
    // not kept
  }
}

/**
 * An item's Edit page - everything that changes an item happens here (user's
 * call): the fields, its type, adding by voice or text (the AI fills the
 * fields; the ones it changed are marked), deleting the recording. Nothing is
 * saved until Save; Cancel drops it all, including what the AI proposed.
 */
export function ItemEditor({
  item,
  saved,
  captureId,
  talk,
  onDone,
}: {
  item: { itemType: ItemType; id: string; title: string }
  /** The item as saved, as a form. */
  saved: ItemForm
  /** The capture it came from (null: made by hand - one is made when something is said). */
  captureId: string | null
  /** Opened with the mic shortcut: start recording at once. */
  talk?: boolean
  /** `moved`: the type changed, so it has a new id. `followUp`: words to capture as a new entry. */
  onDone: (result: { moved?: { itemType: ItemType; id: string }; followUp?: string } | null) => void
}) {
  const { zone } = useAuth()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Draft>(
    () => loadDraft(item.id, saved) ?? { saved, form: saved, changed: [], proposals: [], unrelated: [], deleteRecording: false },
  )
  const { form, changed, proposals, unrelated, deleteRecording } = draft
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clarifications, setClarifications] = useState<string[]>([])
  const resolvedCapture = useRef<string | null>(captureId)
  const capture = useQuery({
    queryKey: ['capture', captureId],
    queryFn: () => capturesApi.get(captureId!),
    enabled: !!captureId,
  })

  const dirty = formChanged(form, saved) || proposals.length > 0 || deleteRecording
  useEffect(() => storeDraft(item.id, dirty ? draft : null), [item.id, draft, dirty])
  // Reloading or closing the tab with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const set = (patch: Partial<ItemForm>) =>
    setDraft((d) => ({ ...d, form: { ...d.form, ...patch }, changed: d.changed.filter((k) => !(k in patch)) }))

  // What was said or typed: the AI's version of the item fills the form.
  const onResult = (result: Capture) => {
    const target: AppendTarget = { itemType: item.itemType, itemId: item.id, title: item.title }
    const fresh = reviewItems(result, target).filter((i) => !draft.proposals.some((p) => p.item.id === i.id))
    setDraft((d) => {
      let next = d.form
      const marks = new Set(d.changed)
      for (const proposal of fresh) {
        const applied = applyProposal(next, d.saved, proposal, zone.timeZone)
        next = applied.form
        applied.changed.forEach((k) => marks.add(k))
      }
      return {
        ...d,
        form: next,
        changed: [...marks],
        proposals: [...d.proposals, ...fresh.map((p) => ({ captureId: result.id, item: p }))],
        unrelated: [...d.unrelated, ...fresh.filter((p) => p.unrelated).map((p) => ({ text: p.unrelated!, capture: true }))],
      }
    })
    setClarifications(fresh.map((p) => p.clarification).filter((c): c is string => !!c))
    resolvedCapture.current = result.id
  }

  const problems = formProblems(form)
  const save = async () => {
    if (busy || problems.length) return
    setBusy(true)
    setError(null)
    try {
      const result = await saveItemForm(api, {
        item: { itemType: item.itemType, id: item.id },
        form,
        tz: zone.timeZone,
        proposals,
        deleteRecordingOf: deleteRecording ? captureId : null,
      })
      storeDraft(item.id, null)
      // The old item is gone after a type change: refresh everything but it (it would 404).
      const gone = result.id !== item.id ? [DETAIL_KEY[item.itemType], item.id] : null
      void queryClient.invalidateQueries({ predicate: (q) => !gone || q.queryKey[0] !== gone[0] || q.queryKey[1] !== gone[1] })
      const followUp = unrelated.filter((u) => u.capture).map((u) => u.text).join(' ') || undefined
      onDone({ moved: result.id !== item.id ? result : undefined, followUp })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      setBusy(false)
    }
  }

  const cancel = async () => {
    setBusy(true)
    await discardProposals(api, proposals).catch(() => {}) // left pending at worst - the banner offers it
    storeDraft(item.id, null)
    if (proposals.length) await queryClient.invalidateQueries()
    onDone(null)
  }

  const mark = (key: FormField) => (changed.includes(key) ? ' changed' : '')
  const isNote = form.type === 'Note'
  const recording = capture.data && capture.data.source === 'Voice' && capture.data.audioParts > 0 ? capture.data : null

  return (
    // Not a <form>: the voice/text box inside is one of its own.
    <div className="card form item-editor">
      <h3>{t(form.type === 'Task' ? 'task.edit' : form.type === 'Appointment' ? 'event.edit' : 'note.edit')}</h3>

      {/* Say or type a change: the AI fills the fields below. First, so talking is what you see. */}
      <section className="edit-voice first" aria-label={t('form.addByVoice')}>
        <h4>
          <IoMicOutline aria-hidden /> {t('form.addByVoice')}
        </h4>
        <p className="muted small">{t('form.addHint')}</p>
        <CaptureBar
          continueFrom={{
            captureId:
              captureId ??
              (async () => resolvedCapture.current ?? (resolvedCapture.current = (await capturesApi.forItem(item.itemType, item.id)).id)),
            target: { itemType: item.itemType, itemId: item.id, title: item.title },
            onResult,
            autoStart: talk,
          }}
        />
        {changed.length > 0 && (
          <p className="ai-filled">
            <IoSparkles aria-hidden /> {t('form.aiFilled')}
          </p>
        )}
        {clarifications.map((c) => (
          <p key={c} className="clarification">
            {c}
          </p>
        ))}
        {unrelated.map((u, i) => (
          <label key={i} className="inline-check unrelated">
            <input
              type="checkbox"
              checked={u.capture}
              onChange={(e) => setDraft((d) => ({ ...d, unrelated: d.unrelated.map((x, j) => (j === i ? { ...x, capture: e.target.checked } : x)) }))}
            />
            <span>{t('review.captureUnrelated', { text: u.text })}</span>
          </label>
        ))}
      </section>

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
              onClick={() => setDraft((d) => ({ ...d, form: switchType(d.form, type, zone.timeZone), changed: d.changed.filter((k) => k !== 'type') }))}>
              <Icon aria-hidden /> {KIND_LABEL[type]}
            </button>
          )
        })}
      </div>
      {form.type !== item.itemType && <p className="type-change">{t('review.typeChange', { from: KIND_LABEL[item.itemType], to: KIND_LABEL[form.type] })}</p>}

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
            <Field label={t('task.priority')} changed={mark('priority')}>
              <select value={form.priority} onChange={(e) => set({ priority: e.target.value as TaskPriority })}>
                {['None', 'Low', 'Medium', 'High'].map((p) => (
                  <option key={p} value={p}>
                    {priorityLabel(p)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <label className="inline-check">
            <input type="checkbox" checked={form.ongoing} onChange={(e) => set({ ongoing: e.target.checked })} />
            {t('task.ongoingCheck')}
          </label>
          <Field label={<>{t('task.tags')} <span className="muted">{t('item.commaSeparated')}</span></>} changed={mark('tags')}>
            <input value={form.tags} onChange={(e) => set({ tags: e.target.value })} />
          </Field>
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
          <Field label={t('event.location')} changed={mark('location')}>
            <input value={form.location} onChange={(e) => set({ location: e.target.value })} />
          </Field>
          <Field label={<>{t('event.with')} <span className="muted">{t('item.commaSeparated')}</span></>} changed={mark('people')}>
            <input value={form.people} onChange={(e) => set({ people: e.target.value })} />
          </Field>
        </>
      )}

      <div className={`field${mark('reminders')}`}>
        <span>{t('item.reminder')}</span>
        <ReminderList value={form.reminders} onChange={(reminders) => set({ reminders })} itemHasTime={formHasTime(form)} isNote={isNote} />
      </div>

      <Field label={isNote ? t('kind.note') : t('item.description')} changed={mark('details')}>
        <textarea rows={isNote ? 6 : 3} value={form.details} onChange={(e) => set({ details: e.target.value })} />
      </Field>
      {!isNote && (
        <Field label={t('item.notes')} changed={mark('notes')}>
          <textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      )}

      {recording && captureId && (
        <section className="edit-recording">
          <h4>{t('form.recording')}</h4>
          {deleteRecording ? (
            <p className="muted">
              {t('form.recordingWillBeDeleted')}{' '}
              <button type="button" className="link" onClick={() => setDraft((d) => ({ ...d, deleteRecording: false }))}>
                {t('common.undo')}
              </button>
            </p>
          ) : (
            <>
              <RecordingPlayer
                captureId={captureId}
                parts={recording.audioParts}
                clips={itemClips(recording, { itemType: item.itemType, itemId: item.id, title: item.title })}
              />
              <button type="button" className="link danger" onClick={() => setDraft((d) => ({ ...d, deleteRecording: true }))}>
                {t('source.deleteAudio')}
              </button>
            </>
          )}
        </section>
      )}

      {problems.length > 0 && dirty && <p className="error">{problems.join(' ')}</p>}
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="button" onClick={() => void cancel()} disabled={busy}>
          {t('common.cancel')}
        </button>
        <button type="button" className="primary" disabled={busy || problems.length > 0} onClick={() => void save()}>
          {t('item.saveChanges')}
        </button>
      </div>
    </div>
  )
}

const DETAIL_KEY = { Task: 'task', Appointment: 'appointment', Note: 'note' } as const

/** A labelled field; `changed` marks one the AI just filled in. */
function Field({ label, changed, children }: { label: ReactNode; changed: string; children: ReactNode }) {
  return (
    <label className={changed ? 'changed' : undefined} title={changed ? t('form.changedByAi') : undefined}>
      {label}
      {children}
    </label>
  )
}
