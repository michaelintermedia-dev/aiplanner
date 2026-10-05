import { t } from '@shared/i18n'
import type { Capture, ItemType } from '@shared/types'
import { useEffect, useRef, useState } from 'react'
import { IoCreateOutline, IoMicOutline } from 'react-icons/io5'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { capturesApi } from '../api/endpoints'
import { itemPath } from '../lib/notifications'
import { CaptureReview } from './CaptureReview'

/**
 * An item page's view / Edit switch. `?edit=1` opens Edit, `?talk=1` opens it
 * recording. After Save: a type change opens the new item; words that weren't
 * about the item are captured and their review shown (FollowUpReview).
 */
export function useEditMode() {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [mode, setMode] = useState<null | 'edit' | 'talk'>(params.get('talk') === '1' ? 'talk' : params.get('edit') === '1' ? 'edit' : null)
  const [followUp, setFollowUp] = useState<string | null>(() => (location.state as { followUp?: string } | null)?.followUp ?? null)

  const done = (result: { moved?: { itemType: ItemType; id: string }; followUp?: string } | null) => {
    setMode(null)
    if (result?.moved) navigate(itemPath({ itemType: result.moved.itemType, itemId: result.moved.id }), { replace: true, state: { followUp: result.followUp } })
    else if (result?.followUp) setFollowUp(result.followUp)
  }

  return { mode, edit: () => setMode('edit'), talk: () => setMode('talk'), done, followUp, clearFollowUp: () => setFollowUp(null) }
}

/** Edit, plus the mic shortcut: Edit with recording already on. */
export function EditButtons({ onEdit, onTalk, disabled }: { onEdit: () => void; onTalk: () => void; disabled?: boolean }) {
  return (
    <>
      <button type="button" disabled={disabled} onClick={onEdit}>
        <IoCreateOutline aria-hidden /> {t('common.edit')}
      </button>
      <button type="button" className="icon-button talk-button" disabled={disabled} onClick={onTalk} aria-label={t('form.talk')} title={t('form.talkHint')}>
        <IoMicOutline aria-hidden />
      </button>
    </>
  )
}

/** Words said while editing an item that weren't about it: captured as a new entry, reviewed here. */
export function FollowUpReview({ text, onDone }: { text: string; onDone: () => void }) {
  const [capture, setCapture] = useState<Capture | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Captured exactly once - not a query: saving the review refreshes every query,
  // which would capture the same words again.
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    capturesApi.text(text).then(setCapture, (err: unknown) => setError(err instanceof Error ? err.message : t('common.error')))
  }, [text])
  if (error) return <p className="error">{error}</p>
  if (!capture) return <p className="muted">{t('capture.understanding')}</p>
  return <CaptureReview capture={capture} onDone={onDone} />
}

/** The view says when there are unsaved changes in Edit (leaving Edit keeps them on this device). */
export function DraftNotice({ show, onContinue }: { show: boolean; onContinue: () => void }) {
  if (!show) return null
  return (
    <div className="pending-review" role="status">
      <span>{t('form.draftNotice')}</span>
      <button type="button" className="link" onClick={onContinue}>
        {t('form.continueEditing')}
      </button>
    </div>
  )
}
