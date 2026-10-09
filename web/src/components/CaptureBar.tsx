import { savedNotice, type SavedNotice } from '@shared/captureDraft'
import type { AppendTarget, Capture, ItemType } from '@shared/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { IoArrowUp, IoAttachOutline, IoCheckmark, IoEyeOutline } from 'react-icons/io5'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { searchFilters } from '@shared/feedFilter'
import { setFeedFilters } from '../lib/feedFilters'
import { capturesApi, settingsApi } from '../api/endpoints'
import { itemPath } from '../lib/itemPath'
import { applyMedia, attachmentsKey, type PendingMedia } from '../lib/media'
import { toWav } from '../lib/toWav'
import { useAudioRecorder, type RecorderState } from '../lib/useAudioRecorder'
import { useMicrophones } from '../lib/useMicrophones'
import { usePendingReview } from '../lib/usePendingReview'
import { CaptureReview } from './CaptureReview'
import { EntryReview, entryProposal } from './EntryReview'
import { MediaEditor } from './ItemMedia'
import { LevelMeter } from './LevelMeter'
import { MicButton } from './MicButton'
import { speedRef, usePlaybackSpeed } from '../lib/playbackSpeed'
import { SpeedChips } from './SpeedChips'
import { t } from '@shared/i18n'


/** How long "Saved as ..." stays in the bar. */
const SAVED_MESSAGE_MS = 6000

type Busy = null | 'transcribing' | 'understanding'

/**
 * While paused, an object URL for everything recorded so far, so the user can
 * listen before sending. Rebuilt on every pause; revoked when replaced.
 */
function usePreview(state: RecorderState, pauseCount: number, snapshot: () => Promise<Blob | null>) {
  const [preview, setPreview] = useState<{ url: string; pause: number } | null>(null)
  useEffect(() => {
    if (state !== 'paused') return
    let created: string | null = null
    let cancelled = false
    // Preview the WAV that Send will upload: it's exactly what gets sent, and
    // unlike the recorder's WebM it has a duration the player can show.
    void snapshot()
      .then((blob) => (blob && blob.size > 0 ? toWav(blob) : null))
      .then((wav) => {
        if (cancelled || !wav) return
        created = URL.createObjectURL(wav)
        setPreview({ url: created, pause: pauseCount })
      })
      .catch(() => {}) // No preview is fine; Send still works.
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [state, pauseCount, snapshot])
  // A preview from an earlier pause has been revoked; never hand it to <audio>.
  return state === 'paused' && preview?.pause === pauseCount ? preview.url : null
}

/** The form for a continue request, naming the item continued from. */
const captureIdOf = async ({ captureId }: ContinueFrom) => (typeof captureId === 'string' ? captureId : captureId())

function continueForm({ target, onResult, itemState }: ContinueFrom) {
  const form = new FormData()
  // The Edit form collects several additions before Save: keep the earlier ones pending.
  if (onResult) form.append('keepEarlier', 'true')
  if (itemState) form.append('itemState', itemState())
  // No target: the review of a new entry (the AI works on the form, nothing is saved yet).
  if (target) {
    form.append('itemType', target.itemType)
    form.append('itemId', target.itemId)
  }
  return form
}

const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** Adding to an existing capture from an item's page ("continue talking"). */
export interface ContinueFrom {
  /** Or a function that gets it when first needed (an item made by hand gets one then). */
  captureId: string | (() => Promise<string>)
  /** The saved item it adds to; none in a new entry's review (see EntryReview). */
  target?: AppendTarget
  onClose?: () => void
  /** The item's Edit form: it takes the AI's answer itself (fills its fields) - no review here. */
  onResult?: (capture: Capture) => void
  /** Start recording at once (the mic shortcut on an item's page). */
  autoStart?: boolean
  /** The Edit form's current state (the AI's item shape), read when the words are sent: the AI works on that. */
  itemState?: () => string
  /** Saving changed the item's type, so it has a new id: show that one. */
  onMoved?: (item: { itemType: ItemType; itemId: string }) => void
}

/**
 * Quick capture (spec section 14): type or speak, the AI proposes items, the
 * user reviews them. Nothing is saved until "Save" on the review.
 * With `continueFrom` the same bar adds to an existing capture instead.
 */
export function CaptureBar({
  continueFrom,
  onEngagedChange,
  onFinished,
}: {
  continueFrom?: ContinueFrom
  /** Recording, sending or reviewing: the floating dock must not collapse or hide meanwhile. */
  onEngagedChange?: (engaged: boolean) => void
  /** A capture is done - saved (what it became) or cancelled (null): the dock folds into its bubble. */
  onFinished?: (saved: SavedNotice | null) => void
} = {}) {
  const recorder = useAudioRecorder()
  const [speed] = usePlaybackSpeed()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [capture, setCapture] = useState<Capture | null>(null)
  const engaged = recorder.state === 'recording' || recorder.state === 'paused' || busy !== null || capture !== null
  useEffect(() => onEngagedChange?.(engaged), [engaged, onEngagedChange])
  // A review left unfinished earlier (not when adding to an item - that has its own review).
  const pending = usePendingReview(!continueFrom && capture === null)
  // Resumed from the banner: an unsaved "Add more" review of a saved item.
  const [resumedTarget, setResumedTarget] = useState<AppendTarget | undefined>()
  // Reviewing the words an "Add more" wasn't about, captured as a new entry.
  const [followUp, setFollowUp] = useState(false)
  // Reloading or closing the tab mid-review asks first (it can be resumed, but say so).
  useEffect(() => {
    if (!capture) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [capture])
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  // "Save right away": what it was saved as, to open it.
  const [savedLink, setSavedLink] = useState<string | null>(null)

  // "Saved as ..." is news for a moment, not a label: it goes after a few seconds or once something new is typed.
  useEffect(() => {
    if (!savedMessage) return
    const timer = setTimeout(() => {
      setSavedMessage(null)
      setSavedLink(null)
    }, SAVED_MESSAGE_MS)
    return () => clearTimeout(timer)
  }, [savedMessage])
  // Typing something new: the old "Saved as ..." is gone.
  const typed = (value: string) => {
    setText(value)
    if (value) setSavedMessage(null)
  }
  const preview = usePreview(recorder.state, recorder.pauseCount, recorder.snapshot)
  const mics = useMicrophones()
  const [silent, setSilent] = useState(false)
  // Photos and files for a new entry (the drawer under the paperclip): added to it once it's saved.
  const [media, setMedia] = useState<PendingMedia[]>([])
  const [drawer, setDrawer] = useState(false)

  const queryClient = useQueryClient()

  // Photos/documents go to OpenAI only with the user's OK - asked once, then it's a setting.
  const recordingSettings = useQuery({ queryKey: ['settings', 'recordings'], queryFn: settingsApi.recordings, enabled: !continueFrom })
  const aiReadsMedia = recordingSettings.data?.aiReadsMedia
  const [asking, setAsking] = useState<(() => void) | null>(null)
  const withConsent = (go: () => void) => {
    if (!continueFrom && media.length > 0 && recordingSettings.data && aiReadsMedia == null) setAsking(() => go)
    else go()
  }
  const answer = async (agree: boolean) => {
    const go = asking
    setAsking(null)
    try {
      const saved = await settingsApi.updateRecordings({ ...recordingSettings.data!, aiReadsMedia: agree })
      queryClient.setQueryData(['settings', 'recordings'], saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      return
    }
    // Declined with only a photo: there's nothing for the AI to go on.
    if (!agree && !text.trim() && !(recorder.state === 'recording' || recorder.state === 'paused')) setError(t('capture.mediaNeedsWords'))
    else go?.()
  }

  /** Saved: the picked photos and files go to (the first) saved item. A cancelled review keeps them here. */
  const finish = (saved: SavedNotice | null) => {
    if (saved?.first && media.length > 0) {
      const target = saved.first
      const files = media
      saved = { ...saved, message: `${saved.message} ${t('capture.withMedia', { count: files.length })}` }
      setMedia([])
      setDrawer(false)
      void applyMedia(target, files, [], { removed: () => {}, uploaded: () => {} })
        .catch((err) => setError(err instanceof Error ? err.message : t('common.error')))
        .finally(() => void queryClient.invalidateQueries({ queryKey: attachmentsKey(target.itemType, target.id) }))
    }
    return saved
  }
  const navigate = useNavigate()
  const run = async (phase: Exclude<Busy, null>, work: () => Promise<Capture>) => {
    setBusy(phase)
    setError(null)
    setSavedMessage(null)
    setSavedLink(null)
    try {
      const result = await work()
      if (continueFrom?.onResult) continueFrom.onResult(result)
      else if (result.search) {
        // "Find ...": nothing to save - show the feed filtered by what was asked.
        const { filters, show } = searchFilters(result.search)
        setFeedFilters(filters)
        navigate(`/feed?show=${show}`)
        setSavedMessage(t('capture.searchShown'))
        onFinished?.({ message: t('capture.searchShown'), item: null })
      } else if (result.autoSaved) {
        // Saved already (Settings - Save right away): say what it became, no review.
        const notice = finish(savedNotice(result, 1))!
        const item = notice.item
        setSavedMessage(notice.message)
        onFinished?.(notice)
        setSavedLink(item && itemPath(item))
        void queryClient.invalidateQueries()
      } else setCapture(result)
      setText('')
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      return false
    } finally {
      setBusy(null)
      // A new capture is pending until saved: the "Unsaved review" banner must know it at once.
      void queryClient.invalidateQueries({ queryKey: ['captures'] })
    }
  }

  // Save (the smart button, and Enter) or Review: saveNow=false always shows the review.
  const submitText = (e?: FormEvent, saveNow = true) => {
    e?.preventDefault()
    // A new entry can be just a photo or document: the AI reads it and makes the title.
    if (!text.trim() && !(media.length > 0 && !continueFrom && aiReadsMedia !== false)) return
    withConsent(() => sendText(saveNow))
  }

  const sendText = (saveNow: boolean) => {
    void run('understanding', async () => {
      if (!continueFrom && media.length > 0) {
        const form = new FormData()
        form.append('text', text.trim())
        if (saveNow) form.append('saveNow', 'true')
        for (const m of media) form.append('media', m.file, m.file.name)
        return capturesApi.textWithMedia(form)
      }
      if (!continueFrom) return capturesApi.text(text.trim(), saveNow)
      const form = continueForm(continueFrom)
      form.append('text', text.trim())
      return capturesApi.continue(await captureIdOf(continueFrom), form)
    })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter adds a line.
    if (e.key === 'Enter' && !e.shiftKey) submitText(e)
  }

  const sendRecording = async (saveNow = true) => {
    const recording = await recorder.stop()
    await run('transcribing', async () => {
      // Upload WAV, not the recorder's WebM - see toWav for why.
      const form = continueFrom ? continueForm(continueFrom) : new FormData()
      form.append('audio', await toWav(recording.blob), 'recording.wav')
      if (!continueFrom && saveNow) form.append('saveNow', 'true')
      // Photos/documents said about ("add this to my calendar"): the AI reads them with the words.
      if (!continueFrom) for (const m of media) form.append('media', m.file, m.file.name)
      return continueFrom ? capturesApi.continue(await captureIdOf(continueFrom), form) : capturesApi.voice(form)
    })
  }

  const onMicError = (err: unknown) => {
    const name = err instanceof DOMException ? err.name : ''
    setError(
      name === 'NotAllowedError'
        ? t('mic.error.blocked')
        : name === 'NotFoundError' || name === 'OverconstrainedError'
          ? t('mic.error.notFound')
          : name === 'NotReadableError'
            ? t('mic.error.busy')
            : err instanceof Error
              ? err.message
              : t('mic.error.couldNotStart'),
    )
  }

  const startRecording = async (deviceId = mics.selected) => {
    setError(null)
    setSavedMessage(null)
    setSilent(false)
    await recorder.record(deviceId)
    mics.refresh() // device names become visible once permission is granted
  }

  // The mic shortcut on an item's page: recording starts as the form opens (once - not again on a re-render).
  // "Quick recording" (the home-screen icon's shortcut, ?record=1): the main bar starts at once.
  const [params, setParams] = useSearchParams()
  const quick = !continueFrom && params.get('record') === '1'
  const autoStarted = useRef(false)
  useEffect(() => {
    // Quick recording can come again (a long press on the dock's bubble): ready for the next one.
    if (!continueFrom && !quick) autoStarted.current = false
    if (!(continueFrom?.autoStart || quick) || autoStarted.current) return
    autoStarted.current = true
    if (quick) {
      setParams(
        (p) => {
          p.delete('record')
          return p
        },
        { replace: true },
      )
    }
    void startRecording().catch(onMicError)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the form opens
  }, [quick])

  // Switching input mid-recording restarts it on the new mic: the old take is
  // usually the silent one the user is trying to fix.
  const switchMic = async (deviceId: string | null) => {
    mics.choose(deviceId)
    if (recorder.state === 'recording' || recorder.state === 'paused') {
      recorder.discard()
      await startRecording(deviceId).catch(onMicError)
    }
  }

  // A new entry: its review is the full Edit form (user's call, 2026-10-09).
  if (capture && !continueFrom && !resumedTarget && entryProposal(capture)) {
    return (
      <EntryReview
        capture={capture}
        media={media}
        onMedia={setMedia}
        onDone={(saved, followUpWords) => {
          setCapture(null)
          if (followUpWords) {
            // Other words said while changing it: their own review comes next.
            setFollowUp(true)
            void run('understanding', () => capturesApi.text(followUpWords)).then(() => setFollowUp(false))
          }
          saved = finish(saved)
          setSavedMessage(saved?.message ?? null)
          setSavedLink(saved?.item ? itemPath(saved.item) : null)
          onFinished?.(saved)
        }}
      />
    )
  }

  if (capture) {
    return (
      <>
      {!continueFrom && media.length > 0 && (
        <p className="muted capture-media-note">
          <IoAttachOutline aria-hidden /> {t('capture.mediaNote', { count: media.length })}
        </p>
      )}
      <CaptureReview
        capture={capture}
        appendTarget={followUp ? undefined : (continueFrom?.target ?? resumedTarget)}
        onMoved={followUp ? undefined : continueFrom?.onMoved}
        onDone={(saved, followUpWords) => {
          setCapture(null)
          setResumedTarget(undefined)
          if (followUpWords) {
            // "Also call mom tonight" said while adding to an item: its own review comes next.
            setFollowUp(true)
            void run('understanding', () => capturesApi.text(followUpWords)).then((ok) => {
              if (!ok) setFollowUp(false)
              setSavedMessage(saved?.message ?? null)
            })
            return
          }
          setFollowUp(false)
          if (continueFrom) continueFrom.onClose?.()
          else {
            saved = finish(saved)
            setSavedMessage(saved?.message ?? null)
            setSavedLink(saved?.item ? itemPath(saved.item) : null)
            // Saved or cancelled: this capture is done (the dock folds away).
            onFinished?.(saved)
          }
        }}
      />
      </>
    )
  }

  const hasAudio = recorder.state === 'recording' || recorder.state === 'paused'

  return (
    <>
    {pending.capture && !hasAudio && busy === null && (
      // A review left unfinished earlier: never silently lost.
      <div className="pending-review" role="status">
        <span>
          {pending.appendTarget
            ? t('review.pendingAddition', { title: pending.appendTarget.title })
            : t('review.pending', { title: pending.capture.title })}
        </span>
        {pending.resumable && (
          <button
            type="button"
            className="link"
            onClick={() => {
              setResumedTarget(pending.appendTarget)
              setCapture(pending.capture)
            }}>
            {t('review.resume')}
          </button>
        )}
        <button type="button" className="link danger" disabled={pending.discard.isPending} onClick={() => pending.discard.mutate(pending.capture!)}>
          {t('capture.discard')}
        </button>
        {pending.others > 0 && (
          <button type="button" className="link danger" disabled={pending.discardAll.isPending} onClick={() => pending.discardAll.mutate(undefined)}>
            {t('review.discardAll', { count: pending.others + 1 })}
          </button>
        )}
      </div>
    )}
    <form className="capture" onSubmit={submitText}>
      {hasAudio ? (
        <div className="capture-recording">
          <span className={`rec-dot${recorder.state === 'paused' ? ' paused' : ''}`} />
          <span className="rec-time">{formatDuration(recorder.seconds)}</span>
          {recorder.stream && (
            <LevelMeter stream={recorder.stream} active={recorder.state === 'recording'} onSilenceChange={setSilent} />
          )}
          <span className="muted" aria-live="polite">
            {recorder.state === 'recording' ? t('capture.listening') : recorder.atLimit ? t('capture.atLimit') : t('capture.paused')}
          </span>
          {silent && recorder.state === 'recording' && (
            <p className="mic-warning" role="alert">
              {mics.devices.length > 1 ? t('mic.silentPickAnother') : t('mic.silent')}
            </p>
          )}
          {recorder.state === 'paused' && preview && (
            <>
              <audio className="rec-preview" controls src={preview} aria-label={t('capture.listenSoFar')} ref={speedRef(speed)} />
              <SpeedChips />
            </>
          )}
        </div>
      ) : (
        <textarea
          className="capture-input"
          placeholder={
            continueFrom ? t('capture.continuePlaceholder') : t('capture.placeholder')
          }
          value={text}
          onChange={(e) => typed(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          disabled={busy !== null}
          aria-label={continueFrom ? t('capture.textToAdd') : t('capture.text')}
          autoFocus={!!continueFrom}
        />
      )}
      {drawer && !continueFrom && (
        <div className="capture-drawer" id="capture-media">
          <MediaEditor pending={media} onPending={setMedia} />
          {aiReadsMedia === false && media.length > 0 && <p className="muted small">{t('capture.mediaNotRead')}</p>}
        </div>
      )}
      {asking && (
        <div className="consent" role="alertdialog" aria-labelledby="consent-title">
          <strong id="consent-title">{t('consent.mediaTitle')}</strong>
          <p>{t('consent.mediaBody')}</p>
          <p className="muted small">{t('consent.settingsNote')}</p>
          <div className="consent-actions">
            <button type="button" className="link" onClick={() => void answer(false)}>
              {t('consent.notNow')}
            </button>
            <button type="button" className="primary" onClick={() => void answer(true)} autoFocus>
              {t('consent.agree')}
            </button>
          </div>
        </div>
      )}
      <div className="capture-actions">
        {/* Photos and files for the new entry, tucked away in a drawer. */}
        {!continueFrom && (
          <button
            type="button"
            className={`attach-toggle${drawer ? ' active' : ''}`}
            onClick={() => setDrawer((d) => !d)}
            disabled={busy !== null}
            aria-expanded={drawer}
            aria-controls="capture-media"
            aria-label={t('capture.attach')}
            title={t('capture.attach')}>
            <IoAttachOutline aria-hidden />
            {media.length > 0 && <span className="attach-count">{media.length}</span>}
          </button>
        )}
        {busy ? (
          <span className="muted capture-status" aria-live="polite">
            <span className="spinner" /> {busy === 'transcribing' ? t('capture.transcribing') : t('capture.understanding')}
          </span>
        ) : (
          <span className="muted capture-hint">
            {hasAudio ? '' : (savedMessage ?? t('capture.hint'))}
            {!hasAudio && savedMessage && savedLink && (
              <>
                {' '}
                <Link to={savedLink}>{t('capture.open')}</Link>
              </>
            )}
          </span>
        )}
        {mics.devices.length > 1 && !busy && (
          <label className="mic-select">
            {t('mic.label')}
            <select
              value={mics.selected ?? ''}
              onChange={(e) => void switchMic(e.target.value || null)}
              aria-label={t('mic.microphone')}>
              <option value="">{t('mic.systemDefault')}</option>
              {mics.devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {hasAudio && (
          <button type="button" className="link" onClick={recorder.discard}>
            {t('capture.discard')}
          </button>
        )}
        {continueFrom?.onClose && !hasAudio && !busy && (
          <button type="button" className="link" onClick={continueFrom.onClose}>
            {t('common.cancel')}
          </button>
        )}
        {/* Something to send: adding to an item has one send arrow (the form reviews it); a new
            entry has Review and the smart Save (saved at once unless something is unclear). */}
        {(hasAudio || text.trim() || (!continueFrom && media.length > 0 && aiReadsMedia !== false)) &&
          (continueFrom ? (
            <button
              type={hasAudio ? 'button' : 'submit'}
              className="send"
              onClick={hasAudio ? () => void sendRecording(false) : undefined}
              disabled={busy !== null || (hasAudio && recorder.seconds < 1)}
              aria-label={hasAudio ? t('capture.sendRecording') : t('capture.send')}
              title={hasAudio ? t('capture.sendRecording') : t('capture.sendEnter')}>
              <IoArrowUp aria-hidden />
            </button>
          ) : (
            <>
              <button
                type="button"
                className="review-first"
                onClick={() => (hasAudio ? withConsent(() => void sendRecording(false)) : submitText(undefined, false))}
                disabled={busy !== null || (hasAudio && recorder.seconds < 1)}
                title={t('capture.reviewHint')}>
                <IoEyeOutline aria-hidden /> {t('capture.review')}
              </button>
              <button
                type={hasAudio ? 'button' : 'submit'}
                className="send"
                onClick={hasAudio ? () => withConsent(() => void sendRecording(true)) : undefined}
                disabled={busy !== null || (hasAudio && recorder.seconds < 1)}
                aria-label={t('capture.save')}
                title={t('capture.saveHint')}>
                <IoCheckmark aria-hidden />
              </button>
            </>
          ))}
        {/* Rightmost, so it never moves between presses - hold-to-talk aims at a fixed spot. */}
        {recorder.state !== 'unsupported' && (
          <MicButton
            state={recorder.state}
            record={() => (recorder.state === 'paused' ? recorder.record() : startRecording())}
            pause={recorder.pause}
            disabled={busy !== null}
            onError={onMicError}
          />
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </form>
    </>
  )
}
