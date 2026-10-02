import { draftHasTime, draftProblems, INTENT_OPTIONS, toConfirmItem, toDraft, type ItemDraft } from '@shared/captureDraft'
import type { AppendTarget, Capture, TaskPriority } from '@shared/types'
import { useState } from 'react'
import { capturesApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { useAction } from '../lib/useAction'
import { ReminderList } from './ReminderList'
import { t } from '@shared/i18n'
import { priorityLabel } from '@shared/labels'

/**
 * "I understood:" - the review screen (spec section 18). Every property is
 * editable; only checked items are saved, and only when the user presses Save.
 */
export function CaptureReview({
  capture,
  onDone,
  appendTarget,
}: {
  capture: Capture
  onDone: (message: string | null) => void
  /** Reviewing a continued capture: offer "Add to this <item>". */
  appendTarget?: AppendTarget
}) {
  const { zone } = useAuth()
  const confirm = useAction((items: ReturnType<typeof toConfirmItem>[]) => capturesApi.confirm(capture.id, items))
  const [drafts, setDrafts] = useState<ItemDraft[]>(() =>
    capture.items.filter((i) => i.status === 'PendingReview').map((i) => toDraft(i, zone.timeZone, !!appendTarget)),
  )

  const update = (id: string, patch: Partial<ItemDraft>) =>
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)))

  const included = drafts.filter((d) => d.include)
  const blocked = drafts.some((d) => draftProblems(d).length > 0)

  const save = () =>
    confirm.mutate(
      drafts.map((d) => toConfirmItem(d, zone.timeZone, appendTarget)),
      { onSuccess: () => onDone(included.length ? t('review.saved', { count: included.length }) : null) },
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
    <section className="card review" aria-label={t('review.aria')}>
      {appendTarget ? (
        // Continuing: the capture and its transcription are already shown around this.
        <p className="muted">{t('review.understoodAddition')}</p>
      ) : (
        <>
          <header className="review-header">
            <div>
              <p className="muted">{t('review.understood')}</p>
              <h3>{capture.title}</h3>
            </div>
            <span className="badge">{capture.source === 'Voice' ? `🎤 ${t('capture.voice')}` : t('capture.typed')}</span>
          </header>
          {capture.summary && <p className="review-summary">{capture.summary}</p>}
          <details className="transcript">
            <summary>{capture.source === 'Voice' ? t('capture.fullTranscription') : t('capture.whatYouTyped')}</summary>
            <p>{capture.inputText}</p>
          </details>
        </>
      )}

      {drafts.length === 0 ? (
        <p className="empty">{t('review.nothing')}</p>
      ) : (
        <ul className="review-items">
          {drafts.map((d) => (
            <ItemEditor key={d.id} draft={d} onChange={(patch) => update(d.id, patch)} appendTarget={appendTarget} />
          ))}
        </ul>
      )}

      {confirm.error && <p className="error">{confirm.error.message}</p>}
      <div className="form-actions">
        <button type="button" onClick={discard} disabled={confirm.isPending}>
          {t('common.cancel')}
        </button>
        <button type="button" className="primary" onClick={save} disabled={confirm.isPending || blocked || drafts.length === 0}>
          {included.length === drafts.length ? t('review.saveAll') : t('review.saveSome', { count: included.length })}
        </button>
      </div>
    </section>
  )
}

const ADD_TO = { Task: 'review.addToTask', Appointment: 'review.addToEvent', Note: 'review.addToNote' } as const

function ItemEditor({
  draft: d,
  onChange,
  appendTarget,
}: {
  draft: ItemDraft
  onChange: (patch: Partial<ItemDraft>) => void
  appendTarget?: AppendTarget
}) {
  const problems = draftProblems(d)
  const isNote = d.intent === 'Note'

  return (
    <li className={`review-item intent-${d.intent.toLowerCase()}${d.include ? '' : ' excluded'}`}>
      <div className="review-item-head">
        <input
          type="checkbox"
          checked={d.include}
          onChange={(e) => onChange({ include: e.target.checked })}
          aria-label={d.include ? t('review.include') : t('review.excluded')}
        />
        <input
          className="review-title"
          value={d.title}
          onChange={(e) => onChange({ title: e.target.value })}
          aria-label={t('item.title')}
        />
      </div>

      {d.include && (
        // Any item can be any type (user's rule) - switching keeps the dates.
        // A reminder isn't a type: every type has its own reminder below.
        <div className="intent-chips" role="radiogroup" aria-label={t('review.saveAs')}>
          {appendTarget && (
            // Continuing from an item: this can complete it instead of becoming a new one.
            <button
              type="button"
              role="radio"
              aria-checked={d.appendTo}
              className={`intent-chip append${d.appendTo ? ' selected' : ''}`}
              onClick={() => onChange({ appendTo: true })}
              title={t('review.addToTitle', { title: appendTarget.title })}>
              {t(ADD_TO[appendTarget.itemType])}
            </button>
          )}
          {INTENT_OPTIONS.map((o) => (
            <button
              key={o.intent}
              type="button"
              role="radio"
              aria-checked={!d.appendTo && d.intent === o.intent}
              className={`intent-chip intent-${o.intent.toLowerCase()}${!d.appendTo && d.intent === o.intent ? ' selected' : ''}`}
              onClick={() => onChange({ intent: o.intent, appendTo: false })}>
              {o.label}
            </button>
          ))}
        </div>
      )}

      {d.include && !d.appendTo && (
        <div className="review-fields">
          {!isNote && (
            <>
              <label>
                {t('item.date')}
                <input type="date" value={d.date ?? ''} onChange={(e) => onChange({ date: e.target.value || null })} />
              </label>
              <label>
                {d.intent === 'Appointment' ? t('event.start') : t('item.time')}
                <input type="time" value={d.time ?? ''} onChange={(e) => onChange({ time: e.target.value || null })} />
              </label>
            </>
          )}
          {d.intent === 'Appointment' && (
            <>
              <label>
                {t('event.end')}
                <input type="time" value={d.endTime ?? ''} onChange={(e) => onChange({ endTime: e.target.value || null })} />
              </label>
              <label>
                {t('event.location')}
                <input value={d.location ?? ''} onChange={(e) => onChange({ location: e.target.value || null })} />
              </label>
            </>
          )}
          {d.intent === 'Task' && (
            <label>
              {t('task.priority')}
              <select
                value={d.priority ?? 'None'}
                onChange={(e) => onChange({ priority: e.target.value === 'None' ? null : (e.target.value as TaskPriority) })}>
                {['None', 'Low', 'Medium', 'High'].map((p) => (
                  <option key={p} value={p}>
                    {priorityLabel(p)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {d.include && !d.appendTo && (
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
          {d.appendTo && appendTarget ? t('review.addedTo', { title: appendTarget.title }) : d.intent === 'Note' ? t('review.noteText') : t('review.details')}
          <textarea
            rows={d.intent === 'Note' || d.appendTo ? 4 : 2}
            value={d.description ?? ''}
            placeholder={d.appendTo ? t('review.whatToAdd') : d.intent === 'Note' ? t('review.noteKeep') : t('review.optional')}
            onChange={(e) => onChange({ description: e.target.value || null })}
          />
        </label>
      )}
      {d.include && d.clarification && <p className="clarification">❓ {d.clarification}</p>}
      {problems.length > 0 && <p className="error">{problems.join(' ')}</p>}
    </li>
  )
}
