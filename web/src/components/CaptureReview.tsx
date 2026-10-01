import { draftHasTime, draftProblems, INTENT_OPTIONS, toConfirmItem, toDraft, type ItemDraft } from '@shared/captureDraft'
import type { Capture, TaskPriority } from '@shared/types'
import { useState } from 'react'
import { capturesApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { useAction } from '../lib/useAction'
import { ReminderList } from './ReminderList'

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
        // A reminder isn't a type: every type has its own reminder below.
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
          {!isNote && (
            <>
              <label>
                Date
                <input type="date" value={d.date ?? ''} onChange={(e) => onChange({ date: e.target.value || null })} />
              </label>
              <label>
                {d.intent === 'Appointment' ? 'Start' : 'Time'}
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
        </div>
      )}

      {d.include && (
        <ReminderList
          value={d.reminders}
          onChange={(reminders) => onChange({ reminders })}
          itemHasTime={draftHasTime(d)}
          isNote={isNote}
          showProblem={false}
        />
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
