import type { Capture } from '@shared/types'
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { capturesApi } from '../api/endpoints'
import { useAudioRecorder } from '../lib/useAudioRecorder'
import { CaptureReview } from './CaptureReview'

type Phase = 'idle' | 'recording' | 'transcribing' | 'understanding'

/**
 * Quick capture (spec section 14): type or speak, the AI proposes items, the
 * user reviews them. Nothing is saved until "Save" on the review.
 */
export function CaptureBar() {
  const recorder = useAudioRecorder()
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [capture, setCapture] = useState<Capture | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const run = async (phaseName: Phase, work: () => Promise<Capture>) => {
    setPhase(phaseName)
    setError(null)
    setSavedMessage(null)
    try {
      setCapture(await work())
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setPhase('idle')
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

  const toggleRecording = async () => {
    setError(null)
    setSavedMessage(null)
    if (recorder.state === 'recording') {
      const recording = await recorder.stop()
      const form = new FormData()
      form.append('audio', recording.blob, recording.fileName)
      await run('transcribing', () => capturesApi.voice(form))
      return
    }
    try {
      await recorder.start()
      setPhase('recording')
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow it in the browser to record.'
          : err instanceof Error
            ? err.message
            : 'Could not start recording.',
      )
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

  const busy = phase === 'transcribing' || phase === 'understanding'
  const recording = recorder.state === 'recording'

  return (
    <form className="capture" onSubmit={submitText}>
      {recording ? (
        <div className="capture-recording" aria-live="polite">
          <span className="rec-dot" /> Listening… {Math.floor(recorder.seconds / 60)}:
          {String(recorder.seconds % 60).padStart(2, '0')}
          <button type="button" className="link" onClick={() => { recorder.cancel(); setPhase('idle') }}>
            Discard
          </button>
        </div>
      ) : (
        <textarea
          className="capture-input"
          placeholder="What's on your mind? e.g. “Dentist next Thursday at 9:30 and finish the slides by Friday”"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          disabled={busy}
          aria-label="Capture text"
        />
      )}
      <div className="capture-actions">
        {busy ? (
          <span className="muted capture-status" aria-live="polite">
            <span className="spinner" /> {phase === 'transcribing' ? 'Transcribing and understanding…' : 'Understanding…'}
          </span>
        ) : (
          <span className="muted capture-hint">{savedMessage ?? 'Type or speak — I’ll turn it into tasks and events.'}</span>
        )}
        {recorder.state !== 'unsupported' && (
          <button
            type="button"
            className={`mic${recording ? ' recording' : ''}`}
            onClick={toggleRecording}
            disabled={busy}
            aria-label={recording ? 'Stop recording' : 'Record voice'}
            title={recording ? 'Stop and process' : 'Record voice'}>
            {recording ? '■' : '🎤'}
          </button>
        )}
        {!recording && (
          <button type="submit" className="primary" disabled={!text.trim() || busy}>
            Understand
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
