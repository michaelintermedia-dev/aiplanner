import Ionicons from '@expo/vector-icons/Ionicons'
import type { AppendTarget, Capture } from '@shared/types'
import { File } from 'expo-file-system'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { capturesApi } from '@/api/endpoints'
import { useSegmentRecorder } from '@/lib/useSegmentRecorder'
import { useColors } from '@/theme'
import { CaptureReview } from './CaptureReview'
import { LevelMeter } from './LevelMeter'
import { MicButton } from './MicButton'
import { SegmentPlayer } from './SegmentPlayer'
import { Button } from './ui'

type Busy = null | 'transcribing' | 'understanding'

const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** Adding to an existing capture from an item's screen ("continue talking"). */
export interface ContinueFrom {
  captureId: string
  target: AppendTarget
  onClose: () => void
}

/** The form for a continue request, naming the item continued from. */
function continueForm({ target }: ContinueFrom) {
  const form = new FormData()
  form.append('itemType', target.itemType)
  form.append('itemId', target.itemId)
  return form
}

/**
 * Quick capture (spec sections 14-15): type, or talk with the big mic; the AI
 * proposes items; the user reviews them. Nothing is saved until Save.
 * With `continueFrom` the same bar adds to an existing capture instead.
 */
export function CaptureBar({ continueFrom }: { continueFrom?: ContinueFrom } = {}) {
  const c = useColors()
  const recorder = useSegmentRecorder()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [capture, setCapture] = useState<Capture | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [silent, setSilent] = useState(false)

  // Stop at the 10-minute cap (uploads are limited in size).
  useEffect(() => {
    if (recorder.state === 'recording' && recorder.atLimit) void recorder.pause()
  }, [recorder])

  /** Runs a capture request; returns whether it succeeded. */
  const run = async (phase: Exclude<Busy, null>, work: () => Promise<Capture>) => {
    setBusy(phase)
    setError(null)
    setSavedMessage(null)
    try {
      setCapture(await work())
      setText('')
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      return false
    } finally {
      setBusy(null)
    }
  }

  const submitText = () => {
    if (!text.trim()) return
    void run('understanding', () => {
      if (!continueFrom) return capturesApi.text(text.trim())
      const form = continueForm(continueFrom)
      form.append('text', text.trim())
      return capturesApi.continue(continueFrom.captureId, form)
    })
  }

  const send = async () => {
    const segments = await recorder.finish()
    if (segments.length === 0) {
      setError('Nothing was recorded.')
      return
    }
    const sent = await run('transcribing', () => {
      const form = continueFrom ? continueForm(continueFrom) : new FormData()
      // Expo's fetch (the global fetch since SDK 52) doesn't accept React
      // Native's { uri, name, type } parts; an expo-file-system File is a Blob.
      segments.forEach((s, i) => form.append('audio', new File(s.uri), `part-${i + 1}.m4a`))
      return continueFrom ? capturesApi.continue(continueFrom.captureId, form) : capturesApi.voice(form)
    })
    // On failure the recording stays (paused) so the user can retry Send.
    if (sent) recorder.clear()
  }

  const onMicError = (err: unknown) => setError(err instanceof Error ? err.message : 'Could not use the microphone.')

  if (capture) {
    return (
      <CaptureReview
        capture={capture}
        appendTarget={continueFrom?.target}
        onDone={(message) => {
          setCapture(null)
          if (continueFrom) continueFrom.onClose()
          else setSavedMessage(message)
        }}
      />
    )
  }

  const hasAudio = recorder.state !== 'idle'

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: hasAudio ? c.accent : c.border }]}>
      {hasAudio ? (
        <View style={styles.recording}>
          <View style={styles.recordingRow}>
            <View style={[styles.dot, { backgroundColor: c.danger, opacity: recorder.state === 'recording' ? 1 : 0.35 }]} />
            <Text style={[styles.time, { color: c.text }]}>{formatDuration(recorder.seconds)}</Text>
            <LevelMeter metering={recorder.metering} active={recorder.state === 'recording'} onSilenceChange={setSilent} />
          </View>
          <Text style={{ color: c.muted }} accessibilityLiveRegion="polite">
            {recorder.state === 'recording'
              ? 'Listening…'
              : recorder.atLimit
                ? 'That’s the 10-minute maximum — send it with the arrow, or Discard.'
                : 'Paused — press the arrow to send it, Listen to hear it, or the mic to add more.'}
          </Text>
          {silent && recorder.state === 'recording' && (
            <Text style={{ color: c.warn }} accessibilityRole="alert">
              I can’t hear anything. Check the microphone isn’t muted or blocked.
            </Text>
          )}
        </View>
      ) : (
        <TextInput
          style={[styles.input, { color: c.text }]}
          placeholder={continueFrom ? 'Add to it: hold the mic and keep talking, or type' : "What's on your mind? Or hold the mic and talk."}
          placeholderTextColor={c.muted}
          value={text}
          onChangeText={setText}
          multiline
          editable={busy === null}
          accessibilityLabel={continueFrom ? 'Text to add' : 'Capture text'}
        />
      )}

      {busy ? (
        <View style={styles.busy} accessibilityLiveRegion="polite">
          <ActivityIndicator color={c.accent} />
          <Text style={{ color: c.muted }}>{busy === 'transcribing' ? 'Transcribing and understanding…' : 'Understanding…'}</Text>
        </View>
      ) : (
        !hasAudio && savedMessage && <Text style={{ color: c.muted }}>{savedMessage}</Text>
      )}
      {error && <Text style={{ color: c.danger }}>{error}</Text>}

      <View style={styles.actions}>
        <View style={styles.buttons}>
          {hasAudio ? (
            <>
              {recorder.state === 'paused' && <SegmentPlayer segments={recorder.segments} />}
              <Button title="Discard" variant="link" onPress={() => void recorder.discard()} disabled={busy !== null} />
              <SendButton
                label="Send recording"
                onPress={send}
                disabled={busy !== null || (recorder.seconds < 1 && recorder.segments.length === 0)}
              />
            </>
          ) : (
            <>
              {continueFrom && busy === null && <Button title="Cancel" variant="link" onPress={continueFrom.onClose} />}
              {/* One send arrow for typed text and recordings; it only shows when there's something to send. */}
              {text.trim() !== '' && <SendButton label="Send" onPress={submitText} disabled={busy !== null} />}
            </>
          )}
        </View>
        {/* Fixed position on the right, so hold-to-talk always hits it. */}
        <MicButton
          state={recorder.state}
          record={async () => {
            setError(null)
            setSavedMessage(null)
            setSilent(false)
            await recorder.record()
          }}
          pause={recorder.pause}
          disabled={busy !== null}
          onError={onMicError}
        />
      </View>
    </View>
  )
}

function SendButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[styles.send, { backgroundColor: c.accent, opacity: disabled ? 0.5 : 1 }]}>
      <Ionicons name="arrow-up" size={24} color="#fff" />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  input: { fontSize: 17, minHeight: 56, textAlignVertical: 'top' },
  recording: { gap: 8, minHeight: 56 },
  recordingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  time: { fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  buttons: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'flex-end' },
})
