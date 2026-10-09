import { reviewItems } from '@shared/captureDraft'
import { KIND_LABEL } from '@shared/feed'
import { t } from '@shared/i18n'
import {
  applyProposal,
  discardProposals,
  formChanged,
  formProblems,
  formAsAiItem,
  SaveConflict,
  saveItemForm,
  switchType,
  type FormField,
  type ItemForm,
  type MergedProposal,
} from '@shared/itemForm'
import type { AppendTarget, Capture, ItemType } from '@shared/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { IoMicOutline, IoSparkles } from 'react-icons/io5'
import { api, capturesApi } from '../api/endpoints'
import { applyMedia, type PendingMedia } from '../lib/media'
import { useAuth } from '../auth/useAuth'
import { CaptureBar } from './CaptureBar'
import { MediaEditor } from './ItemMedia'
import { RecordingPlayer } from './SourceCapture'
import { ItemFields } from './ItemFields'

/** Whether there are unsaved changes to this item (the view says so). */
export const hasEditDraft = (id: string, saved: ItemForm) => !!loadDraft(id, saved)

/** What the form keeps on this device while editing (leaving and coming back restores it). */
interface Draft {
  saved: ItemForm
  form: ItemForm
  changed: FormField[]
  proposals: MergedProposal[]
  unrelated: { text: string; capture: boolean }[]
  deleteRecording: boolean
  /** Attachments to remove on Save (picked files can't be kept here - they're in memory only). */
  removeMedia?: string[]
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
  const removeMedia = draft.removeMedia ?? []
  // Photos/documents picked here: uploaded on Save (not kept if the page is left).
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clarifications, setClarifications] = useState<string[]>([])
  const resolvedCapture = useRef<string | null>(captureId)
  // A type change went through but the rest of Save failed: Save carries on with the new item.
  const [current, setCurrent] = useState(item)
  // A type change keeps the id (one kind of item underneath) but not the page: it moved.
  const isMoved = (r: { itemType: ItemType; id: string }) => r.id !== item.id || r.itemType !== item.itemType
  // The form as it was when the last words were sent - what the AI's answer is compared with.
  const sent = useRef<ItemForm | null>(null)
  // Save stopped: the item was changed somewhere else meanwhile.
  const [conflict, setConflict] = useState(false)
  // The capture whose recording the form plays - also one made on the first addition to an item made by hand.
  const [captureRef, setCaptureRef] = useState<string | null>(captureId)
  const capture = useQuery({ queryKey: ['capture', captureRef], queryFn: () => capturesApi.get(captureRef!), enabled: !!captureRef })
  // Voice was just added: the recording plays it already, but it's only kept on Save.
  const [addedVoice, setAddedVoice] = useState(false)

  const dirty = formChanged(form, saved) || proposals.length > 0 || deleteRecording || removeMedia.length > 0 || pendingMedia.length > 0

  // Opened without a stored draft: additions from a draft that was lost (another
  // browser's storage cleared, app reinstalled) would stay pending for ever - drop them.
  const cleared = useRef(false)
  useEffect(() => {
    if (cleared.current || !capture.data) return
    cleared.current = true
    const mine = new Set(draft.proposals.map((p) => p.item.id))
    const lost = capture.data.items.filter(
      (i) => i.status === 'PendingReview' && i.heldByEditForm && i.continuesItemId === item.id && !mine.has(i.id),
    )
    if (lost.length) void discardProposals(api, lost.map((i) => ({ captureId: capture.data!.id, item: i }))).catch(() => {})
  }, [capture.data, draft.proposals, item.id])
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
        const applied = applyProposal(next, sent.current ?? d.form, proposal, zone.timeZone)
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
    // Before Save, hear the whole recording - the earlier parts and the one just added
    // (the server joins it on at once; Cancel takes it back out).
    if (result.audioParts > (capture.data?.audioParts ?? 0)) setAddedVoice(true)
    queryClient.setQueryData(['capture', result.id], result)
    setCaptureRef(result.id)
  }

  const problems = formProblems(form)
  const save = async (force = false) => {
    if (busy || problems.length) return
    setBusy(true)
    setError(null)
    setConflict(false)
    try {
      const result = await saveItemForm(api, {
        item: { itemType: current.itemType, id: current.id },
        form,
        // As it was when editing started (the page's copy refreshes under the form).
        saved: draft.saved,
        // After a half-done type change the item is new (and differs from `saved` by design).
        force: force || isMoved(current),
        tz: zone.timeZone,
        proposals,
        deleteRecordingOf: deleteRecording ? captureRef : null,
        media:
          pendingMedia.length || removeMedia.length
            ? (target) =>
                applyMedia(target, pendingMedia, removeMedia, {
                  removed: () => setDraft((d) => ({ ...d, removeMedia: [] })),
                  uploaded: (key) => setPendingMedia((p) => p.filter((x) => x.key !== key)),
                })
            : undefined,
      })
      storeDraft(item.id, null)
      // The recording is gone: don't let the item's page fetch it from the stale capture (404s).
      if (deleteRecording && captureRef) queryClient.setQueryData<Capture>(['capture', captureRef], (c) => c && { ...c, audioParts: 0 })
      // The old item is gone after a type change: refresh everything but it (it would 404).
      const gone = isMoved(result) ? [DETAIL_KEY[item.itemType], item.id] : null
      void queryClient.invalidateQueries({ predicate: (q) => !gone || q.queryKey[0] !== gone[0] || q.queryKey[1] !== gone[1] })
      const followUp = unrelated.filter((u) => u.capture).map((u) => u.text).join(' ') || undefined
      onDone({ moved: isMoved(result) ? result : undefined, followUp })
    } catch (err) {
      setBusy(false)
      if (err instanceof SaveConflict) {
        setConflict(true)
        return
      }
      const moved = (err as { moved?: { itemType: ItemType; id: string } }).moved
      if (moved) setCurrent({ ...moved, title: item.title })
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const cancel = async () => {
    setBusy(true)
    await discardProposals(api, proposals).catch(() => {}) // left pending at worst - cleared next time Edit opens
    pendingMedia.forEach((p) => p.preview && URL.revokeObjectURL(p.preview))
    storeDraft(item.id, null)
    // Reload the item (after "Discard my changes" the page's copy is stale).
    const gone = isMoved(current) ? [DETAIL_KEY[item.itemType], item.id] : null
    await queryClient.invalidateQueries({ predicate: (q) => !gone || q.queryKey[0] !== gone[0] || q.queryKey[1] !== gone[1] })
    // A type change already went through: the item is the new one now.
    onDone(isMoved(current) ? { moved: { itemType: current.itemType, id: current.id } } : null)
  }

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
            itemState: () => {
              sent.current = form
              return formAsAiItem(form, zone.timeZone)
            },
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

      <ItemFields
        form={form}
        set={set}
        setType={(type) => setDraft((d) => ({ ...d, form: switchType(d.form, type, zone.timeZone), changed: d.changed.filter((k) => k !== 'type') }))}
        changed={changed}
        afterType={
          form.type !== item.itemType && <p className="type-change">{t('review.typeChange', { from: KIND_LABEL[item.itemType], to: KIND_LABEL[form.type] })}</p>
        }
      />

      <MediaEditor
        itemType={current.itemType}
        id={current.id}
        pending={pendingMedia}
        onPending={setPendingMedia}
        removed={removeMedia}
        onRemoved={(ids) => setDraft((d) => ({ ...d, removeMedia: ids }))}
      />

      {recording && captureRef && (
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
              <RecordingPlayer captureId={captureRef} parts={recording.audioParts} />
              {addedVoice && <p className="muted small">{t('form.recordingAddedNotSaved')}</p>}
              <button type="button" className="link danger" onClick={() => setDraft((d) => ({ ...d, deleteRecording: true }))}>
                {t('source.deleteAudio')}
              </button>
            </>
          )}
        </section>
      )}

      {problems.length > 0 && dirty && <p className="error">{problems.join(' ')}</p>}
      {conflict && (
        <div className="conflict" role="alert">
          <p>{t('form.conflict')}</p>
          <button type="button" className="primary" onClick={() => void save(true)}>
            {t('form.saveAnyway')}
          </button>
          <button type="button" onClick={() => void cancel()}>
            {t('form.discardMine')}
          </button>
        </div>
      )}
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
