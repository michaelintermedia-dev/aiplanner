import Ionicons from '@expo/vector-icons/Ionicons'
import * as Haptics from 'expo-haptics'
import { useRef } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import type { RecorderState } from '@/lib/useSegmentRecorder'
import { useColors } from '@/theme'

/** Presses held at least this long are push-to-talk; shorter ones are taps. */
const HOLD_MS = 350

/**
 * The big mic button (spec section 15). Same contract as the web app:
 * - Hold to talk: records while held; letting go pauses.
 * - Tap: a quick tap starts, the next tap pauses.
 * Pressing again continues with a new segment. Pausing never sends.
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
  pause: () => Promise<void>
  disabled?: boolean
  onError: (error: unknown) => void
}) {
  const c = useColors()
  const press = useRef<{ at: number; starting: Promise<void> } | null>(null)
  const recording = state === 'recording'

  const onPressIn = () => {
    if (disabled) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    if (recording) {
      pause().catch(onError) // a tap while recording (tap mode) pauses
      press.current = null
      return
    }
    const starting = record().catch((err) => {
      press.current = null
      onError(err)
    })
    press.current = { at: Date.now(), starting }
  }

  const onPressOut = async () => {
    const p = press.current
    press.current = null
    if (!p) return
    if (Date.now() - p.at >= HOLD_MS) {
      // Push-to-talk release; recording may still be starting (permission prompt).
      await p.starting
      await pause().catch(onError)
    }
    // A short press leaves it recording: tap mode.
  }

  const label =
    state === 'paused'
      ? 'Continue recording. Hold to talk, or tap.'
      : recording
        ? 'Pause recording'
        : 'Record voice. Hold to talk, or tap to start and stop.'

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: recording, disabled }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: recording ? c.danger : c.accent,
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed || recording ? 1.08 : 1 }],
        },
      ]}>
      <Ionicons name={recording ? 'pause' : 'mic'} size={32} color="#fff" />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
})
