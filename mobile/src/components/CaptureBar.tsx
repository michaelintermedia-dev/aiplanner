import Ionicons from '@expo/vector-icons/Ionicons'
import { savedNotice, type SavedNotice } from '@shared/captureDraft'
import type { AppendTarget, Capture, ItemType } from '@shared/types'
import { router } from 'expo-router'
import { File } from 'expo-file-system'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { capturesApi } from '@/api/endpoints'
import { itemPath } from '@/lib/itemPath'
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
  /** Or a function that gets it when first needed (an item made by hand gets one then). */
  captureId: string | (() => Promise<string>)
  target: AppendTarget
  onClose?: () => void
  /** The item's Edit form: it takes the AI's answer itself (fills its fields) - no review here. */
  onResult?: (capture: Capture) => void
  /** Each new value starts recording (the floating mic tapped on the item's page). */
  talkSignal?: number
  /** The Edit form's current state (the AI's item shape), read when the words are sent: the AI works on that. */
  itemState?: () => string
  /** Saving changed the item's type, so it has a new id: show that one. */
  onMoved?: (item: { itemType: ItemType; itemId: string }) => void
}

/** The form for a continue request, naming the item continued from. */
const captureIdOf = async ({ captureId }: ContinueFrom) => (typeof captureId === 'string' ? captureId : captureId())

function continueForm({ target, onResult, itemState }: ContinueFrom) {
  const form = new FormData()
  // The Edit form collects several additions before Save: keep the earlier ones pending.
  if (onResult) form.append('keepEarlier', 'true')
  if (itemState) form.append('itemState', itemState())
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
  talkSignal: quickSignal,
  onFinished,
}: {
  /** A capture is done - saved (what it became) or cancelled (null): the dock folds into its bubble. */
  onFinished?: (saved: SavedNotice | null) => void
  continueFrom?: ContinueFrom
  /** Each new value starts recording ("Quick recording" from the home-screen widget). */
  talkSignal?: number
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
  // Resumed from the banner: an unsaved "Add more" review of a saved item.
  const [resumedTarget, setResumedTarget] = useState<AppendTarget | undefined>()
  // Reviewing the words an "Add more" wasn't about, captured as a new entry.
  const [followUp, setFollowUp] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  // "Save right away": what it was saved as, to open it.
  const [savedLink, setSavedLink] = useState<string | null>(null)
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
    setSavedLink(null)
    try {
      const result = await work()
      if (continueFrom?.onResult) continueFrom.onResult(result)
      else if (result.autoSaved) {
        // Saved already (Settings - Save right away): say what it became, no review.
        const notice = savedNotice(result, 1)
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

  const submitText = () => {
    if (!text.trim()) return
    void run('understanding', async () => {
      if (!continueFrom) return capturesApi.text(text.trim())
      const form = continueForm(continueFrom)
      form.append('text', text.trim())
      return capturesApi.continue(await captureIdOf(continueFrom), form)
    })
  }

  const send = async () => {
    const segments = await recorder.finish()
    if (segments.length === 0) {
      setError(t('mic.error.nothing'))
      return
    }
    const sent = await run('transcribing', async () => {
      const form = continueFrom ? continueForm(continueFrom) : new FormData()
      // Expo's fetch (the global fetch since SDK 52) doesn't accept React
      // Native's { uri, name, type } parts; an expo-file-system File is a Blob.
      segments.forEach((s, i) => form.append('audio', new File(s.uri), `part-${i + 1}.m4a`))
      return continueFrom ? capturesApi.continue(await captureIdOf(continueFrom), form) : capturesApi.voice(form)
    })
    // On failure the recording stays (paused) so the user can retry Send.
    if (sent) recorder.clear()
  }

  const onMicError = (err: unknown) => setError(err instanceof Error ? err.message : t('mic.error.couldNotUse'))

  const startRecording = async () => {
    setError(null)
    setSavedMessage(null)
    setSilent(false)
    await recorder.record()
  }

  // The floating mic tapped on the item's page, or Quick recording: start (or go on) recording here.
  const talkSignal = continueFrom?.talkSignal ?? quickSignal ?? 0
  useEffect(() => {
    if (!talkSignal || recorder.state === 'recording' || busy !== null) return
    queueMicrotask(() => startRecording().catch(onMicError))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the signal changes
  }, [talkSignal])

  if (capture) {
    return (
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
            setSavedMessage(saved?.message ?? null)
            setSavedLink(saved?.item ? itemPath(saved.item) : null)
            // Saved or cancelled: this capture is done (the dock folds away).
            onFinished?.(saved)
          }
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
          <Text style={{ color: c.text, flex: 1 }}>
            {pending.appendTarget
              ? t('review.pendingAddition', { title: pending.appendTarget.title })
              : t('review.pending', { title: pending.capture.title })}
          </Text>
          {pending.resumable && (
            <Button
              title={t('review.resume')}
              variant="link"
              onPress={() => {
                setResumedTarget(pending.appendTarget)
                setCapture(pending.capture)
              }}
            />
          )}
          <Button title={t('capture.discard')} variant="danger" disabled={pending.discard.isPending} onPress={() => pending.discard.mutate(pending.capture!)} />
          {pending.others > 0 && (
            <Button
              title={t('review.discardAll', { count: pending.others + 1 })}
              variant="danger"
              disabled={pending.discardAll.isPending}
              onPress={() => pending.discardAll.mutate(undefined)}
            />
          )}
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
        !hasAudio &&
        savedMessage && (
          <Text style={{ color: c.muted }}>
            {savedMessage}
            {savedLink && (
              <Text style={{ color: c.accent }} onPress={() => router.push(savedLink as never)} accessibilityRole="link">
                {'  '}
                {t('capture.open')}
              </Text>
            )}
          </Text>
        )
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
              {continueFrom?.onClose && busy === null && <Button title={t('common.cancel')} variant="link" onPress={continueFrom.onClose} />}
              {/* One send arrow for typed text and recordings; it only shows when there's something to send. */}
              {text.trim() !== '' && <SendButton label={t('capture.send')} onPress={submitText} disabled={busy !== null} />}
            </>
          )}
        </View>
        {/* Fixed position on the right, so hold-to-talk always hits it. */}
        <MicButton
          state={recorder.state}
          record={startRecording}
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
