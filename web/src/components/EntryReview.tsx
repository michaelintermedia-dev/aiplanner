import { savedNotice, type SavedNotice } from '@shared/captureDraft'
import { t } from '@shared/i18n'
import {
  applyProposal,
  discardReviewForm,
  formAsAiItem,
  formFromProposal,
  formProblems,
  saveReviewForm,
  switchType,
  type FormField,
  type ItemForm,
} from '@shared/itemForm'
import type { Capture, CaptureItem } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { IoHelpCircleOutline, IoMicOutline, IoSparkles } from 'react-icons/io5'
import { api, settingsApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import type { PendingMedia } from '../lib/media'
import { CaptureBar } from './CaptureBar'
import { ItemFields } from './ItemFields'
import { MediaEditor } from './ItemMedia'
import { RecordingPlayer } from './SourceCapture'

/** What the review keeps on this device until Save / Cancel (leaving and resuming brings it back). */
interface Stored {
  base: string
  form: ItemForm
  changed: FormField[]
  proposals: CaptureItem[]
  unrelated: { text: string; capture: boolean }[]
}
const storeKey = (captureId: string) => `entry-review:${captureId}`
function load(captureId: string, base: string): Stored | null {
  try {
    const raw = localStorage.getItem(storeKey(captureId))
    const s = raw ? (JSON.parse(raw) as Stored) : null
    return s && s.base === base ? s : null
  } catch {
    return null
  }
}
function store(captureId: string, s: Stored | null) {
  try {
    if (s) localStorage.setItem(storeKey(captureId), JSON.stringify(s))
    else localStorage.removeItem(storeKey(captureId))
  } catch {
    // not kept
  }
}

/** The proposal a new entry's review starts from (the AI's one item). */
export const entryProposal = (capture: Capture) => capture.items.find((i) => i.status === 'PendingReview' && !i.heldByEditForm) ?? null

/**
 * The review of a new entry IS the Edit form (user's call, 2026-10-09): every
 * field the item will have, its photos and documents (open, remove, add), the
 * recording, and "change it by voice or text" - filled in by the AI, nothing
 * saved until Save. Same as the app's EntryReview.
 */
export function EntryReview({
  capture,
  media,
  onMedia,
  onDone,
}: {
  capture: Capture
  /** Photos/documents picked in the capture bar - attached to the entry once it's saved. */
  media: PendingMedia[]
  onMedia: (update: (p: PendingMedia[]) => PendingMedia[]) => void
  /** Saved (what it became) or cancelled (null); `followUp`: other words to capture next. */
  onDone: (saved: SavedNotice | null, followUp?: string | null) => void
}) {
  const { zone } = useAuth()
  const proposal = entryProposal(capture)!
  const [state, setState] = useState<Stored>(
    () =>
      load(capture.id, proposal.id) ?? {
        base: proposal.id,
        form: formFromProposal(proposal, zone.timeZone),
        changed: [],
        proposals: [],
        unrelated: [],
      },
  )
  const { form, changed, proposals, unrelated } = state
  useEffect(() => store(capture.id, state), [capture.id, state])
  const [clarifications, setClarifications] = useState<string[]>(proposal.clarification ? [proposal.clarification] : [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The form as it was when the last words were sent - what the AI's answer is compared with.
  const sent = useRef<ItemForm | null>(null)
  const settings = useQuery({ queryKey: ['settings', 'recordings'], queryFn: settingsApi.recordings })
  const [keepChoice, setKeepChoice] = useState<boolean | null>(null)
  const hasRecording = capture.source === 'Voice' && capture.audioParts > 0
  const keepRecording = keepChoice ?? settings.data?.keepRecordings ?? true

  // Reloading or closing the tab mid-review asks first (it can be resumed, but say so).
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const set = (patch: Partial<ItemForm>) =>
    setState((s) => ({ ...s, form: { ...s.form, ...patch }, changed: s.changed.filter((k) => !(k in patch)) }))

  // "Change it by voice or text": the AI's version fills the form, changed fields are marked.
  const onResult = (result: Capture) => {
    const known = new Set([proposal.id, ...proposals.map((p) => p.id)])
    const fresh = result.items.filter((i) => i.status === 'PendingReview' && i.heldByEditForm && !known.has(i.id))
    setState((s) => {
      let next = s.form
      const marks = new Set(s.changed)
      for (const p of fresh) {
        const applied = applyProposal(next, sent.current ?? s.form, p, zone.timeZone)
        next = applied.form
        applied.changed.forEach((k) => marks.add(k))
      }
      return {
        ...s,
        form: next,
        changed: [...marks],
        proposals: [...s.proposals, ...fresh],
        unrelated: [...s.unrelated, ...fresh.filter((p) => p.unrelated).map((p) => ({ text: p.unrelated!, capture: true }))],
      }
    })
    setClarifications(fresh.map((p) => p.clarification).filter((c): c is string => !!c))
  }

  const problems = formProblems(form)
  const save = async () => {
    if (busy || problems.length) return
    setBusy(true)
    setError(null)
    try {
      const saved = await saveReviewForm(api, { captureId: capture.id, itemId: proposal.id, form, tz: zone.timeZone, proposals, keepRecording: !hasRecording || keepRecording })
      store(capture.id, null)
      onDone(savedNotice(saved, 1), unrelated.filter((u) => u.capture).map((u) => u.text).join(' ') || null)
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }
  const cancel = async () => {
    setBusy(true)
    try {
      await discardReviewForm(api, capture.id, proposal.id, proposals, form, zone.timeZone)
    } catch {
      // left pending at worst - the "unsaved review" banner offers it again
    }
    store(capture.id, null)
    onDone(null)
  }

  return (
    <section className="card form item-editor entry-review" aria-label={t('review.aria')}>
      <header className="review-header">
        <div>
          <p className="muted">{t('review.understood')}</p>
          <h3>{capture.title}</h3>
        </div>
        <span className="badge">
          {capture.source === 'Voice' && <IoMicOutline aria-hidden />} {capture.source === 'Voice' ? t('capture.voice') : t('capture.typed')}
        </span>
      </header>
      <details className="transcript">
        <summary>{capture.source === 'Voice' ? t('capture.fullTranscription') : t('capture.whatYouTyped')}</summary>
        <p>{capture.inputText}</p>
      </details>

      {clarifications.map((c) => (
        <p key={c} className="clarification">
          <IoHelpCircleOutline aria-hidden /> {c}
        </p>
      ))}

      <section className="edit-voice" aria-label={t('form.addByVoice')}>
        <h4>
          <IoMicOutline aria-hidden /> {t('form.addByVoice')}
        </h4>
        <CaptureBar
          continueFrom={{
            captureId: capture.id,
            onResult,
            itemState: () => {
              sent.current = form
              return formAsAiItem(form, zone.timeZone)
            },
          }}
        />
        {changed.length > 0 && (
          <p className="ai-filled">
            <IoSparkles aria-hidden /> {t('form.aiFilled')}
          </p>
        )}
        {unrelated.map((u, i) => (
          <label key={i} className="inline-check unrelated">
            <input
              type="checkbox"
              checked={u.capture}
              onChange={(e) => setState((s) => ({ ...s, unrelated: s.unrelated.map((x, j) => (j === i ? { ...x, capture: e.target.checked } : x)) }))}
            />
            <span>{t('review.captureUnrelated', { text: u.text })}</span>
          </label>
        ))}
      </section>

      <ItemFields
        form={form}
        set={set}
        setType={(type) => setState((s) => ({ ...s, form: switchType(s.form, type, zone.timeZone), changed: s.changed.filter((k) => k !== 'type') }))}
        changed={changed}
      />

      <MediaEditor pending={media} onPending={onMedia} />

      {hasRecording && (
        <section className="edit-recording">
          <h4>{t('form.recording')}</h4>
          <RecordingPlayer captureId={capture.id} parts={capture.audioParts} />
          <label className="inline-check keep-recording">
            <input type="checkbox" checked={keepRecording} onChange={(e) => setKeepChoice(e.target.checked)} />
            {t('review.keepRecording')}
          </label>
        </section>
      )}

      {problems.length > 0 && <p className="error">{problems.join(' ')}</p>}
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="button" onClick={() => void cancel()} disabled={busy}>
          {t('common.cancel')}
        </button>
        <button type="button" className="primary" disabled={busy || problems.length > 0} onClick={() => void save()}>
          {t('common.save')}
        </button>
      </div>
    </section>
  )
}
