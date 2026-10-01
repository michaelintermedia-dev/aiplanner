import { draftProblems, INTENT_OPTIONS, toConfirmItem, toDraft, type ItemDraft } from '@shared/captureDraft'
import type { Capture, TaskPriority } from '@shared/types'
import { useState } from 'react'
import { capturesApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { useAction } from '../lib/useAction'

const REMINDERS = [
  { label: 'No reminder', value: '' },
  { label: 'At the time', value: '0' },
  { label: '10 min before', value: '10' },
  { label: '30 min before', value: '30' },
  { label: '1 hour before', value: '60' },
  { label: '1 day before', value: '1440' },
]

/** A note has no time of its own, so its reminder is just on (at a date/time) or off. */
const NOTE_REMINDERS = [
  { label: 'No reminder', value: '' },
  { label: 'Remind me at…', value: '0' },
]

/** The standard choices, plus whatever the AI proposed if it isn't one of them. */
function reminderOptions(current: number | null, intent: ItemDraft['intent']) {
  if (intent === 'Note') return NOTE_REMINDERS
  if (current === null || REMINDERS.some((r) => r.value === String(current))) return REMINDERS
  return [...REMINDERS, { label: `${current} min before`, value: String(current) }]
}

/**
 * "I understood:" - the review screen (spec section 18). Every property is
 * editable; only checked items are saved, and only when the user presses Save.
 */
export function CaptureReview({ capture, onDone }: { capture: Capture; onDone: (message: string | null) => void }) {
  const { zone } = useAuth()
  const confirm = useAction((items: ReturnType<typeof toConfirmItem>[]) => capturesApi.confirm(capture.id, items))
  const [drafts, setDrafts] = useState<ItemDraft[]>(() =>
    capture.items.filter((i) => i.status === 'PendingReview').map((i) => toDraft(i, zone.timeZone)),
  )

  const update = (id: string, patch: Partial<ItemDraft>) =>
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)))

  const included = drafts.filter((d) => d.include)
  const blocked = drafts.some((d) => draftProblems(d).length > 0)

  const save = () =>
    confirm.mutate(
      drafts.map((d) => toConfirmItem(d, zone.timeZone)),
      { onSuccess: () => onDone(included.length ? `Saved ${included.length} item${included.length > 1 ? 's' : ''}.` : null) },
    )

  // Cancel rejects everything, so the capture doesn't linger as pending.
  const discard = () =>
    drafts.length === 0
      ? onDone(null)
      : confirm.mutate(
          drafts.map((d) => toConfirmItem({ ...d, include: false }, zone.timeZone)),
          { onSuccess: () => onDone(null) },
        )

  return (
    <section className="card review" aria-label="Review what the AI understood">
      <header className="review-header">
        <div>
          <p className="muted">I understood:</p>
          <h3>{capture.title}</h3>
        </div>
        <span className="badge">{capture.source === 'Voice' ? '🎤 Voice' : 'Text'}</span>
      </header>
      {capture.summary && <p className="review-summary">{capture.summary}</p>}
      <details className="transcript">
        <summary>{capture.source === 'Voice' ? 'Full transcription' : 'What you typed'}</summary>
        <p>{capture.inputText}</p>
      </details>

      {drafts.length === 0 ? (
        <p className="empty">I didn’t find anything to plan in that.</p>
      ) : (
        <ul className="review-items">
          {drafts.map((d) => (
            <ItemEditor key={d.id} draft={d} onChange={(patch) => update(d.id, patch)} />
          ))}
        </ul>
      )}

      {confirm.error && <p className="error">{confirm.error.message}</p>}
      <div className="form-actions">
        <button type="button" onClick={discard} disabled={confirm.isPending}>
          Cancel
        </button>
        <button type="button" className="primary" onClick={save} disabled={confirm.isPending || blocked || drafts.length === 0}>
          {included.length === drafts.length ? 'Save all' : `Save ${included.length}`}
        </button>
      </div>
    </section>
  )
}

function ItemEditor({ draft: d, onChange }: { draft: ItemDraft; onChange: (patch: Partial<ItemDraft>) => void }) {
  const problems = draftProblems(d)
  const isNote = d.intent === 'Note'
  // Notes show date/time only to say when to remind.
  const dated = !isNote || d.reminderMinutesBefore !== null

  return (
    <li className={`review-item intent-${d.intent.toLowerCase()}${d.include ? '' : ' excluded'}`}>
      <div className="review-item-head">
        <input
          type="checkbox"
          checked={d.include}
          onChange={(e) => onChange({ include: e.target.checked })}
          aria-label={d.include ? 'Include this item' : 'Excluded'}
        />
        <input
          className="review-title"
          value={d.title}
          onChange={(e) => onChange({ title: e.target.value })}
          aria-label="Title"
        />
      </div>

      {d.include && (
        // Any item can be any type (user's rule) - switching keeps the dates.
        // A reminder isn't a type: every type has its own Reminder field.
        <div className="intent-chips" role="radiogroup" aria-label="Save as">
          {INTENT_OPTIONS.map((o) => (
            <button
              key={o.intent}
              type="button"
              role="radio"
              aria-checked={d.intent === o.intent}
              className={`intent-chip intent-${o.intent.toLowerCase()}${d.intent === o.intent ? ' selected' : ''}`}
              onClick={() => onChange({ intent: o.intent })}>
              {o.label}
            </button>
          ))}
        </div>
      )}

      {d.include && (
        <div className="review-fields">
          {dated && (
            <>
              <label>
                {isNote ? 'Remind me on' : 'Date'}
                <input type="date" value={d.date ?? ''} onChange={(e) => onChange({ date: e.target.value || null })} />
              </label>
              <label>
                {d.intent === 'Appointment' ? 'Start' : isNote ? 'At' : 'Time'}
                <input type="time" value={d.time ?? ''} onChange={(e) => onChange({ time: e.target.value || null })} />
              </label>
            </>
          )}
          {d.intent === 'Appointment' && (
            <>
              <label>
                End
                <input type="time" value={d.endTime ?? ''} onChange={(e) => onChange({ endTime: e.target.value || null })} />
              </label>
              <label>
                Location
                <input value={d.location ?? ''} onChange={(e) => onChange({ location: e.target.value || null })} />
              </label>
            </>
          )}
          {d.intent === 'Task' && (
            <label>
              Priority
              <select
                value={d.priority ?? 'None'}
                onChange={(e) => onChange({ priority: e.target.value === 'None' ? null : (e.target.value as TaskPriority) })}>
                {['None', 'Low', 'Medium', 'High'].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          )}
          {/* On a note the reminder comes first: it's what reveals the date/time. */}
          <label style={isNote ? { order: -1 } : undefined}>
            Reminder
            <select
              value={isNote && d.reminderMinutesBefore !== null ? '0' : (d.reminderMinutesBefore?.toString() ?? '')}
              onChange={(e) => onChange({ reminderMinutesBefore: e.target.value === '' ? null : Number(e.target.value) })}>
              {reminderOptions(d.reminderMinutesBefore, d.intent).map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {d.include && (
        <label className="review-details">
          {d.intent === 'Note' ? 'Note text' : 'Details'}
          <textarea
            rows={d.intent === 'Note' ? 4 : 2}
            value={d.description ?? ''}
            placeholder={d.intent === 'Note' ? 'What do you want to keep?' : 'Optional'}
            onChange={(e) => onChange({ description: e.target.value || null })}
          />
        </label>
      )}
      {d.include && d.clarification && <p className="clarification">❓ {d.clarification}</p>}
      {problems.length > 0 && <p className="error">{problems.join(' ')}</p>}
    </li>
  )
}
