import type { Capture } from '@shared/types'
import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { IoArrowUp } from 'react-icons/io5'
import { capturesApi } from '../api/endpoints'
import { toWav } from '../lib/toWav'
import { useAudioRecorder, type RecorderState } from '../lib/useAudioRecorder'
import { useMicrophones } from '../lib/useMicrophones'
import { CaptureReview } from './CaptureReview'
import { LevelMeter } from './LevelMeter'
import { MicButton } from './MicButton'

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

const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/**
 * Quick capture (spec section 14): type or speak, the AI proposes items, the
 * user reviews them. Nothing is saved until "Save" on the review.
 */
export function CaptureBar() {
  const recorder = useAudioRecorder()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [capture, setCapture] = useState<Capture | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const preview = usePreview(recorder.state, recorder.pauseCount, recorder.snapshot)
  const mics = useMicrophones()
  const [silent, setSilent] = useState(false)

  const run = async (phase: Exclude<Busy, null>, work: () => Promise<Capture>) => {
    setBusy(phase)
    setError(null)
    setSavedMessage(null)
    try {
      setCapture(await work())
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(null)
    }
  }

  const submitText = (e?: FormEvent) => {
    e?.preventDefault()
    if (text.trim()) void run('understanding', () => capturesApi.text(text.trim()))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter adds a line.
    if (e.key === 'Enter' && !e.shiftKey) submitText(e)
  }

  const sendRecording = async () => {
    const recording = await recorder.stop()
    await run('transcribing', async () => {
      // Upload WAV, not the recorder's WebM - see toWav for why.
      const form = new FormData()
      form.append('audio', await toWav(recording.blob), 'recording.wav')
      return capturesApi.voice(form)
    })
  }

  const onMicError = (err: unknown) => {
    const name = err instanceof DOMException ? err.name : ''
    setError(
      name === 'NotAllowedError'
        ? 'Microphone access is blocked. Click the lock icon in the address bar and allow the microphone.'
        : name === 'NotFoundError' || name === 'OverconstrainedError'
          ? 'No microphone found. Plug one in, or pick another input from the Mic list.'
          : name === 'NotReadableError'
            ? 'The microphone is busy or unavailable (another app may be using it).'
            : err instanceof Error
              ? err.message
              : 'Could not start recording.',
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
        onDone={(message) => {
          setCapture(null)
          setSavedMessage(message)
        }}
      />
    )
  }

  const hasAudio = recorder.state === 'recording' || recorder.state === 'paused'

  return (
    <form className="capture" onSubmit={submitText}>
      {hasAudio ? (
        <div className="capture-recording">
          <span className={`rec-dot${recorder.state === 'paused' ? ' paused' : ''}`} />
          <span className="rec-time">{formatDuration(recorder.seconds)}</span>
          {recorder.stream && (
            <LevelMeter stream={recorder.stream} active={recorder.state === 'recording'} onSilenceChange={setSilent} />
          )}
          <span className="muted" aria-live="polite">
            {recorder.state === 'recording'
              ? 'Listening…'
              : recorder.atLimit
                ? 'That’s the 10-minute maximum — send it with the arrow, or Discard.'
                : 'Paused — press the arrow to send it, ▶ to listen, or the mic to add more.'}
          </span>
          {silent && recorder.state === 'recording' && (
            <p className="mic-warning" role="alert">
              I can’t hear anything. Check the microphone isn’t muted
              {mics.devices.length > 1 ? ', or pick another input in the Mic list below' : ''}.
            </p>
          )}
          {recorder.state === 'paused' && preview && (
            <audio className="rec-preview" controls src={preview} aria-label="Listen to the recording so far" />
          )}
        </div>
      ) : (
        <textarea
          className="capture-input"
          placeholder="What's on your mind? e.g. “Dentist next Thursday at 9:30 and finish the slides by Friday”"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          disabled={busy !== null}
          aria-label="Capture text"
        />
      )}
      <div className="capture-actions">
        {busy ? (
          <span className="muted capture-status" aria-live="polite">
            <span className="spinner" /> {busy === 'transcribing' ? 'Transcribing and understanding…' : 'Understanding…'}
          </span>
        ) : (
          <span className="muted capture-hint">
            {hasAudio ? '' : (savedMessage ?? 'Type and press Enter, or hold the mic to talk (tap to start/stop).')}
          </span>
        )}
        {mics.devices.length > 1 && !busy && (
          <label className="mic-select">
            Mic
            <select
              value={mics.selected ?? ''}
              onChange={(e) => void switchMic(e.target.value || null)}
              aria-label="Microphone">
              <option value="">System default</option>
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
            Discard
          </button>
        )}
        {/* One send arrow for typed text and recordings; it only shows when there's something to send. */}
        {hasAudio ? (
          <button
            type="button"
            className="send"
            onClick={sendRecording}
            disabled={busy !== null || recorder.seconds < 1}
            aria-label="Send recording"
            title="Send recording">
            <IoArrowUp aria-hidden />
          </button>
        ) : (
          text.trim() && (
            <button type="submit" className="send" disabled={busy !== null} aria-label="Send" title="Send (Enter)">
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
  )
}
