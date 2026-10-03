import Ionicons from '@expo/vector-icons/Ionicons'
import type { AppendTarget, Capture, ItemType } from '@shared/types'
import { File } from 'expo-file-system'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { capturesApi } from '@/api/endpoints'
import { useSegmentRecorder } from '@/lib/useSegmentRecorder'
import { usePendingReview } from '@/lib/usePendingReview'
import { useColors } from '@/theme'
import { CaptureReview } from './CaptureReview'
import { LevelMeter } from './LevelMeter'
import { MicButton } from './MicButton'
import { SegmentPlayer } from './SegmentPlayer'
import { Button } from './ui'
import { t } from '@shared/i18n'

type Busy = null | 'transcribing' | 'understanding'

const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** Adding to an existing capture from an item's screen ("continue talking"). */
export interface ContinueFrom {
  captureId: string
  target: AppendTarget
  onClose: () => void
  /** Saving changed the item's type, so it has a new id: show that one. */
  onMoved?: (item: { itemType: ItemType; itemId: string }) => void
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
export function CaptureBar({
  continueFrom,
  onEngagedChange,
}: {
  continueFrom?: ContinueFrom
  /** True while recording, processing or reviewing - the dock mustn't hide it then. */
  onEngagedChange?: (engaged: boolean) => void
} = {}) {
  const c = useColors()
  const recorder = useSegmentRecorder()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [capture, setCapture] = useState<Capture | null>(null)
  // A review left unfinished earlier (not when adding to an item - that has its own review).
  const pending = usePendingReview(!continueFrom && capture === null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [silent, setSilent] = useState(false)

  const engaged = recorder.state !== 'idle' || busy !== null || capture !== null
  useEffect(() => onEngagedChange?.(engaged), [engaged, onEngagedChange])

  // Stop at the 10-minute cap (uploads are limited in size).
  useEffect(() => {
    if (recorder.state === 'recording' && recorder.atLimit) void recorder.pause()
  }, [recorder])

  /** Runs a capture request; returns whether it succeeded. */
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
      setError(t('mic.error.nothing'))
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

  const onMicError = (err: unknown) => setError(err instanceof Error ? err.message : t('mic.error.couldNotUse'))

  if (capture) {
    return (
      <CaptureReview
        capture={capture}
        appendTarget={continueFrom?.target}
        onMoved={continueFrom?.onMoved}
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
      {pending.capture && !hasAudio && busy === null && (
        // A review left unfinished earlier: never silently lost.
        <View style={[styles.pending, { borderColor: c.warn }]} accessibilityRole="alert">
          <Text style={{ color: c.text, flex: 1 }}>{t('review.pending', { title: pending.capture.title })}</Text>
          {pending.resumable && <Button title={t('review.resume')} variant="link" onPress={() => setCapture(pending.capture)} />}
          <Button title={t('capture.discard')} variant="danger" disabled={pending.discard.isPending} onPress={() => pending.discard.mutate(pending.capture!)} />
        </View>
      )}
      {hasAudio ? (
        <View style={styles.recording}>
          <View style={styles.recordingRow}>
            <View style={[styles.dot, { backgroundColor: c.danger, opacity: recorder.state === 'recording' ? 1 : 0.35 }]} />
            <Text style={[styles.time, { color: c.text }]}>{formatDuration(recorder.seconds)}</Text>
            <LevelMeter metering={recorder.metering} active={recorder.state === 'recording'} onSilenceChange={setSilent} />
          </View>
          <Text style={{ color: c.muted }} accessibilityLiveRegion="polite">
            {recorder.state === 'recording'
              ? t('capture.listening')
              : recorder.atLimit
                ? t('capture.atLimit')
                : t('capture.pausedMobile')}
          </Text>
          {silent && recorder.state === 'recording' && (
            <Text style={{ color: c.warn }} accessibilityRole="alert">
              {t('mic.silentMobile')}
            </Text>
          )}
        </View>
      ) : (
        <TextInput
          style={[styles.input, { color: c.text }]}
          placeholder={continueFrom ? t('capture.continuePlaceholder') : t('capture.placeholderMobile')}
          placeholderTextColor={c.muted}
          value={text}
          onChangeText={setText}
          multiline
          editable={busy === null}
          accessibilityLabel={continueFrom ? t('capture.textToAdd') : t('capture.text')}
        />
      )}

      {busy ? (
        <View style={styles.busy} accessibilityLiveRegion="polite">
          <ActivityIndicator color={c.accent} />
          <Text style={{ color: c.muted }}>{busy === 'transcribing' ? t('capture.transcribing') : t('capture.understanding')}</Text>
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
              <Button title={t('capture.discard')} variant="link" onPress={() => void recorder.discard()} disabled={busy !== null} />
              <SendButton
                label={t('capture.sendRecording')}
                onPress={send}
                disabled={busy !== null || (recorder.seconds < 1 && recorder.segments.length === 0)}
              />
            </>
          ) : (
            <>
              {continueFrom && busy === null && <Button title={t('common.cancel')} variant="link" onPress={continueFrom.onClose} />}
              {/* One send arrow for typed text and recordings; it only shows when there's something to send. */}
              {text.trim() !== '' && <SendButton label={t('capture.send')} onPress={submitText} disabled={busy !== null} />}
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
  pending: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
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
