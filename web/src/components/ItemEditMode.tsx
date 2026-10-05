import { t } from '@shared/i18n'
import type { ItemType } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
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
  // A query, not an effect: it runs once even when React renders twice.
  const capture = useQuery({ queryKey: ['follow-up', text], queryFn: () => capturesApi.text(text), staleTime: Infinity, retry: false })
  if (capture.isPending) return <p className="muted">{t('capture.understanding')}</p>
  if (capture.error) return <p className="error">{capture.error.message}</p>
  return <CaptureReview capture={capture.data} onDone={onDone} />
}
