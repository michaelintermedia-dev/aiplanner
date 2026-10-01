import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { IoMic, IoPause } from 'react-icons/io5'
import type { RecorderState } from '../lib/useAudioRecorder'

/** Presses held at least this long are push-to-talk; shorter ones are taps. */
const HOLD_MS = 350

/**
 * One button, two ways to record, told apart by press length:
 * - Hold to talk: recording runs while the button is held; releasing pauses.
 * - Tap: a quick tap starts recording, the next tap pauses.
 * Either way, pressing again continues the same recording where it stopped.
 * Keyboard (Space/Enter) behaves like tapping.
 */
export function MicButton({
  state,
  record,
  pause,
  disabled,
  onError,
}: {
  state: RecorderState
  record: () => Promise<void>
  pause: () => void
  disabled?: boolean
  onError: (error: unknown) => void
}) {
  const press = useRef<{ at: number; starting: Promise<void> } | null>(null)
  const recording = state === 'recording'

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || disabled) return
    e.preventDefault()
    // Keep receiving pointerup even if the finger/mouse slides off the button.
    e.currentTarget.setPointerCapture(e.pointerId)

    if (recording) {
      pause() // a tap while recording (tap mode) pauses
      press.current = null
      return
    }
    const starting = record().catch((err) => {
      press.current = null
      onError(err)
    })
    press.current = { at: performance.now(), starting }
  }

  const onPointerUp = async () => {
    const p = press.current
    press.current = null
    if (!p) return
    if (performance.now() - p.at >= HOLD_MS) {
      // Push-to-talk release. Recording may still be starting (first-time
      // permission prompt) - wait for it so the pause isn't lost.
      await p.starting
      pause()
    }
    // A short press leaves it recording: tap mode.
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key !== ' ' && e.key !== 'Enter') || e.repeat || disabled) return
    e.preventDefault()
    if (recording) pause()
    else record().catch(onError)
  }

  const label =
    state === 'paused'
      ? 'Continue recording (hold, or tap)'
      : recording
        ? 'Pause recording'
        : 'Record voice (hold to talk, or tap to start and stop)'

  return (
    <button
      type="button"
      className={`mic${recording ? ' recording' : ''}${state === 'paused' ? ' paused' : ''}`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      disabled={disabled}
      aria-pressed={recording}
      aria-label={label}
      title={label}>
      {recording ? <IoPause aria-hidden /> : <IoMic aria-hidden />}
    </button>
  )
}
