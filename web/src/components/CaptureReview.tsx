import { draftHasTime, draftProblems, followUpText, INTENT_OPTIONS, toConfirmItem, movedItem, reviewItems, suggestedTitle, toDraft, typeChange, updatesWholeItem, type ItemDraft } from '@shared/captureDraft'
import { endsNextDay } from '@shared/dates'
import { KIND_LABEL } from '@shared/feed'
import type { AppendTarget, Capture, TaskPriority, ItemType } from '@shared/types'
import { useEffect, useRef, useState } from 'react'
import { IoHelpCircleOutline, IoLockClosedOutline, IoMicOutline } from 'react-icons/io5'
import { restoreDrafts } from '@shared/pendingReview'
import { reviewDrafts } from '../lib/reviewDrafts'
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
  onMoved,
}: {
  capture: Capture
  /** `followUp`: words to capture as a new entry next (said in "Add more" but not about the item). */
  onDone: (message: string | null, followUp?: string | null) => void
  /** Reviewing a continued capture: offer "Add to this <item>". */
  appendTarget?: AppendTarget
  /** The item's type was changed, so it has a new id. */
  onMoved?: (item: { itemType: ItemType; itemId: string }) => void
}) {
  const { zone } = useAuth()
  const confirm = useAction((items: ReturnType<typeof toConfirmItem>[]) => capturesApi.confirm(capture.id, items), {
    // A type change replaces the item: drop its page's query instead of refetching a deleted item (404).
    forget: (items) => (appendTarget && items.some((i) => movesItem(i, appendTarget)) ? [DETAIL_KEY[appendTarget.itemType], appendTarget.itemId] : ['none']),
  })
  // Edits are kept on this device until Save / Cancel, so Resume brings them back.
  const [drafts, setDrafts] = useState<ItemDraft[]>(() =>
    restoreDrafts(reviewDrafts.load(capture.id), reviewItems(capture, appendTarget).map((i) => toDraft(i, zone.timeZone, appendTarget))),
  )
  useEffect(() => reviewDrafts.save(capture.id, drafts), [capture.id, drafts])
  // One confirm at a time: a double click must not send a second one before the button disables.
  const sending = useRef(false)

  const update = (id: string, patch: Partial<ItemDraft>) =>
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)))

  const included = drafts.filter((d) => d.include)
  const blocked = drafts.some((d) => draftProblems(d).length > 0)

  // The awaited result, not a mutate() callback: saving refreshes the item's
  // page, and when its type changed that page unmounts this review first -
  // which drops mutate() callbacks, but never the promise.
  const save = () => {
    if (sending.current) return
    sending.current = true
    confirm
      .mutateAsync(drafts.map((d) => toConfirmItem(d, zone.timeZone, appendTarget)))
      .then((saved) => {
        reviewDrafts.clear(capture.id)
        onDone(included.length ? t('review.saved', { count: included.length }) : null, followUpText(drafts))
        const moved = movedItem(drafts, saved, appendTarget)
        if (moved) onMoved?.(moved)
      })
      .catch(() => {}) // shown from confirm.error
      .finally(() => (sending.current = false))
  }

  // Cancel rejects everything, so the capture doesn't linger as pending.
  const discard = () =>
    drafts.length === 0
      ? onDone(null)
      : confirm.mutate(
          drafts.map((d) => toConfirmItem({ ...d, include: false }, zone.timeZone)),
          {
            onSuccess: () => {
              reviewDrafts.clear(capture.id)
              onDone(null)
            },
          },
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
            <span className="badge">
              {capture.source === 'Voice' && <IoMicOutline aria-hidden />} {capture.source === 'Voice' ? t('capture.voice') : t('capture.typed')}
            </span>
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
        <button type="button" className="primary" onClick={save} disabled={confirm.isPending || blocked || included.length === 0}>
          {included.length === drafts.length ? t('review.saveAll') : t('review.saveSome', { count: included.length })}
        </button>
      </div>
    </section>
  )
}

const DETAIL_KEY = { Task: 'task', Appointment: 'appointment', Note: 'note' } as const

/** A whole-item update to another type: the item gets a new id and the old one is deleted. */
const movesItem = (i: ReturnType<typeof toConfirmItem>, target: AppendTarget) =>
  i.include && i.replacesItem && (i.intent === 'Appointment' ? 'Appointment' : i.intent === 'Note' ? 'Note' : 'Task') !== target.itemType

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
        {updatesWholeItem(d) && appendTarget ? (
          // Updating the item continued from: its title stays - shown as text, not a field.
          <span className="review-title locked" title={d.useNewTitle ? undefined : t('review.titleKept')}>
            {d.useNewTitle ? d.title : appendTarget.title}
            {!d.useNewTitle && <IoLockClosedOutline aria-label={t('review.titleKept')} />}
          </span>
        ) : (
          <input
            className="review-title"
            value={d.title}
            onChange={(e) => onChange({ title: e.target.value })}
            aria-label={t('item.title')}
          />
        )}
      </div>

      {d.include && (
        // Any item can be any type (user's rule) - switching keeps the dates.
        // A reminder isn't a type: every type has its own reminder below.
        <div className="intent-chips" role="radiogroup" aria-label={t('review.saveAs')}>
          {appendTarget && !updatesWholeItem(d) && (
            // Continuing from an item: this can complete it instead of becoming a new one.
            <button
              type="button"
              role="radio"
              aria-checked={d.appendTo}
              className={`intent-chip append${d.appendTo ? ' selected' : ''}`}
              onClick={() => onChange(d.wholeItem ? { appendTo: true, intent: appendTarget.itemType } : { appendTo: true })}
              title={t('review.addToTitle', { title: appendTarget.title })}>
              {t(ADD_TO[appendTarget.itemType])}
            </button>
          )}
          {INTENT_OPTIONS.map((o) => (
            <button
              key={o.intent}
              type="button"
              role="radio"
              aria-checked={(!d.appendTo || d.wholeItem) && d.intent === o.intent}
              className={`intent-chip intent-${o.intent.toLowerCase()}${(!d.appendTo || d.wholeItem) && d.intent === o.intent ? ' selected' : ''}`}
              // Updating the item: the chips pick its type (it stays the same item).
              onClick={() => onChange(updatesWholeItem(d) ? { intent: o.intent } : { intent: o.intent, appendTo: false })}>
              {o.label}
            </button>
          ))}
        </div>
      )}
      {d.include && updatesWholeItem(d) && appendTarget && <p className="muted small">{t(d.useNewTitle ? 'review.updatesItemRenamed' : 'review.updatesItem', { title: appendTarget.title })}</p>}
      {d.include && suggestedTitle(d, appendTarget) && (
        <label className="inline-check">
          <input type="checkbox" checked={!!d.useNewTitle} onChange={(e) => onChange({ useNewTitle: e.target.checked })} />
          {t('review.useNewTitle', { title: suggestedTitle(d, appendTarget)! })}
        </label>
      )}
      {d.include && typeChange(d, appendTarget) && (
        <p className="type-change">
          {t('review.typeChange', { from: KIND_LABEL[typeChange(d, appendTarget)!.from], to: KIND_LABEL[typeChange(d, appendTarget)!.to as ItemType] })}
        </p>
      )}

      {d.include && (!d.appendTo || d.wholeItem) && (
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
                {endsNextDay(d.time, d.endTime) && <span className="hint warn">{t('event.endsNextDay')}</span>}
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

      {d.include && (!d.appendTo || d.wholeItem) && (
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
          {d.appendTo && !d.wholeItem && appendTarget ? t('review.addedTo', { title: appendTarget.title }) : d.intent === 'Note' ? t('review.noteText') : t('review.details')}
          <textarea
            rows={d.intent === 'Note' || d.appendTo ? 4 : 2}
            value={d.description ?? ''}
            placeholder={d.appendTo && !d.wholeItem ? t('review.whatToAdd') : d.intent === 'Note' ? t('review.noteKeep') : t('review.optional')}
            onChange={(e) => onChange({ description: e.target.value || null })}
          />
        </label>
      )}
      {d.include && d.unrelated && (
        // Words that weren't about this item: offered as a new entry, not dropped.
        <label className="inline-check unrelated">
          <input type="checkbox" checked={d.captureUnrelated} onChange={(e) => onChange({ captureUnrelated: e.target.checked })} />
          <span>{t('review.captureUnrelated', { text: d.unrelated })}</span>
        </label>
      )}
      {d.include && d.clarification && (
        <p className="clarification">
          <IoHelpCircleOutline aria-hidden /> {d.clarification}
        </p>
      )}
      {problems.length > 0 && <p className="error">{problems.join(' ')}</p>}
    </li>
  )
}
