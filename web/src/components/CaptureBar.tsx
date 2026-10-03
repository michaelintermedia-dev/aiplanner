import type { AppendTarget, Capture, ItemType } from '@shared/types'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { IoArrowUp } from 'react-icons/io5'
import { capturesApi } from '../api/endpoints'
import { toWav } from '../lib/toWav'
import { useAudioRecorder, type RecorderState } from '../lib/useAudioRecorder'
import { useMicrophones } from '../lib/useMicrophones'
import { usePendingReview } from '../lib/usePendingReview'
import { CaptureReview } from './CaptureReview'
import { LevelMeter } from './LevelMeter'
import { MicButton } from './MicButton'
import { speedRef, usePlaybackSpeed } from '../lib/playbackSpeed'
import { SpeedChips } from './SpeedChips'
import { t } from '@shared/i18n'

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
function continueForm({ target }: ContinueFrom) {
  const form = new FormData()
  form.append('itemType', target.itemType)
  form.append('itemId', target.itemId)
  return form
}

const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** Adding to an existing capture from an item's page ("continue talking"). */
export interface ContinueFrom {
  captureId: string
  target: AppendTarget
  onClose: () => void
  /** Saving changed the item's type, so it has a new id: show that one. */
  onMoved?: (item: { itemType: ItemType; itemId: string }) => void
}

/**
 * Quick capture (spec section 14): type or speak, the AI proposes items, the
 * user reviews them. Nothing is saved until "Save" on the review.
 * With `continueFrom` the same bar adds to an existing capture instead.
 */
export function CaptureBar({ continueFrom }: { continueFrom?: ContinueFrom } = {}) {
  const recorder = useAudioRecorder()
  const [speed] = usePlaybackSpeed()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [capture, setCapture] = useState<Capture | null>(null)
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
  const preview = usePreview(recorder.state, recorder.pauseCount, recorder.snapshot)
  const mics = useMicrophones()
  const [silent, setSilent] = useState(false)

  const queryClient = useQueryClient()
  const run = async (phase: Exclude<Busy, null>, work: () => Promise<Capture>) => {
    setBusy(phase)
    setError(null)
    setSavedMessage(null)
    try {
      setCapture(await work())
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

  const submitText = (e?: FormEvent) => {
    e?.preventDefault()
    if (!text.trim()) return
    void run('understanding', () => {
      if (!continueFrom) return capturesApi.text(text.trim())
      const form = continueForm(continueFrom)
      form.append('text', text.trim())
      return capturesApi.continue(continueFrom.captureId, form)
    })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter adds a line.
    if (e.key === 'Enter' && !e.shiftKey) submitText(e)
  }

  const sendRecording = async () => {
    const recording = await recorder.stop()
    await run('transcribing', async () => {
      // Upload WAV, not the recorder's WebM - see toWav for why.
      const form = continueFrom ? continueForm(continueFrom) : new FormData()
      form.append('audio', await toWav(recording.blob), 'recording.wav')
      return continueFrom ? capturesApi.continue(continueFrom.captureId, form) : capturesApi.voice(form)
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

  // Switching input mid-recording restarts it on the new mic: the old take is
  // usually the silent one the user is trying to fix.
  const switchMic = async (deviceId: string | null) => {
    mics.choose(deviceId)
    if (recorder.state === 'recording' || recorder.state === 'paused') {
      recorder.discard()
      await startRecording(deviceId).catch(onMicError)
    }
  }

  if (capture) {
    return (
      <CaptureReview
        capture={capture}
        appendTarget={followUp ? undefined : (continueFrom?.target ?? resumedTarget)}
        onMoved={followUp ? undefined : continueFrom?.onMoved}
        onDone={(message, followUpWords) => {
          setCapture(null)
          setResumedTarget(undefined)
          if (followUpWords) {
            // "Also call mom tonight" said while adding to an item: its own review comes next.
            setFollowUp(true)
            void run('understanding', () => capturesApi.text(followUpWords)).then((ok) => {
              if (!ok) setFollowUp(false)
              setSavedMessage(message)
            })
            return
          }
          setFollowUp(false)
          if (continueFrom) continueFrom.onClose()
          else setSavedMessage(message)
        }}
      />
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
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          disabled={busy !== null}
          aria-label={continueFrom ? t('capture.textToAdd') : t('capture.text')}
          autoFocus={!!continueFrom}
        />
      )}
      <div className="capture-actions">
        {busy ? (
          <span className="muted capture-status" aria-live="polite">
            <span className="spinner" /> {busy === 'transcribing' ? t('capture.transcribing') : t('capture.understanding')}
          </span>
        ) : (
          <span className="muted capture-hint">
            {hasAudio ? '' : (savedMessage ?? t('capture.hint'))}
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
        {continueFrom && !hasAudio && !busy && (
          <button type="button" className="link" onClick={continueFrom.onClose}>
            {t('common.cancel')}
          </button>
        )}
        {/* One send arrow for typed text and recordings; it only shows when there's something to send. */}
        {hasAudio ? (
          <button
            type="button"
            className="send"
            onClick={sendRecording}
            disabled={busy !== null || recorder.seconds < 1}
            aria-label={t('capture.sendRecording')}
            title={t('capture.sendRecording')}>
            <IoArrowUp aria-hidden />
          </button>
        ) : (
          text.trim() && (
            <button type="submit" className="send" disabled={busy !== null} aria-label={t('capture.send')} title={t('capture.sendEnter')}>
              <IoArrowUp aria-hidden />
            </button>
          )
        )}
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
