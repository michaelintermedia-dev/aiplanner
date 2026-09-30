import type { Capture } from '@shared/types'
import { File } from 'expo-file-system'
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native'
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

/**
 * Quick capture (spec sections 14-15): type, or talk with the big mic; the AI
 * proposes items; the user reviews them. Nothing is saved until Save.
 */
export function CaptureBar() {
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
    if (text.trim()) void run('understanding', () => capturesApi.text(text.trim()))
  }

  const send = async () => {
    const segments = await recorder.finish()
    if (segments.length === 0) {
      setError('Nothing was recorded.')
      return
    }
    const sent = await run('transcribing', () => {
      const form = new FormData()
      // Expo's fetch (the global fetch since SDK 52) doesn't accept React
      // Native's { uri, name, type } parts; an expo-file-system File is a Blob.
      segments.forEach((s, i) => form.append('audio', new File(s.uri), `part-${i + 1}.m4a`))
      return capturesApi.voice(form)
    })
    // On failure the recording stays (paused) so the user can retry Send.
    if (sent) recorder.clear()
  }

  const onMicError = (err: unknown) => setError(err instanceof Error ? err.message : 'Could not use the microphone.')

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
                ? 'That’s the 10-minute maximum — press Send, or Discard.'
                : 'Paused — press Send to process it, Listen to hear it, or the mic to add more.'}
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
          placeholder="What's on your mind? Or hold the mic and talk."
          placeholderTextColor={c.muted}
          value={text}
          onChangeText={setText}
          multiline
          editable={busy === null}
          accessibilityLabel="Capture text"
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
              <Button
                title="Send"
                variant="primary"
                onPress={send}
                busy={busy !== null}
                disabled={recorder.seconds < 1 && recorder.segments.length === 0}
              />
            </>
          ) : (
            <Button title="Understand" variant="primary" onPress={submitText} busy={busy === 'understanding'} disabled={!text.trim()} />
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

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  input: { fontSize: 17, minHeight: 56, textAlignVertical: 'top' },
  recording: { gap: 8, minHeight: 56 },
  recordingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  time: { fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  buttons: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
})
