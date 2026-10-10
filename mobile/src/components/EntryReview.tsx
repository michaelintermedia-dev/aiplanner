import Ionicons from '@expo/vector-icons/Ionicons'
import { savedNotice, type SavedNotice } from '@shared/captureDraft'
import { t } from '@shared/i18n'
import {
  applyProposal,
  discardReviewForm,
  formAsAiItem,
  formFromProposal,
  formProblems,
  saveReviewForm,
  switchType,
  type FormField,
  type ItemForm,
} from '@shared/itemForm'
import type { Capture, CaptureItem } from '@shared/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native'
import { api, settingsApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import type { PendingMedia } from '@/lib/media'
import { entryDrafts } from '@/lib/reviewDrafts'
import { useColors } from '@/theme'
import { CaptureBar } from './CaptureBar'
import { detailStyles as s } from './detail'
import { ItemFields } from './ItemFields'
import { MediaEditor } from './ItemMedia'
import { RecordingPlayer } from './SourceCapture'
import { Button } from './ui'

/** What the review keeps on the device until Save / Cancel (closing the app and resuming brings it back). */
interface Stored {
  base: string
  form: ItemForm
  changed: FormField[]
  proposals: CaptureItem[]
  unrelated: { text: string; capture: boolean }[]
}

/** The proposal a new entry's review starts from (the AI's one item). */
export const entryProposal = (capture: Capture) => capture.items.find((i) => i.status === 'PendingReview' && !i.heldByEditForm) ?? null

/**
 * The review of a new entry IS the Edit form (user's call, 2026-10-09): every
 * field the item will have, its photos and documents (open, remove, add), the
 * recording, and "change it by voice or text" - filled in by the AI, nothing
 * saved until Save. Same as the web's EntryReview.
 */
export function EntryReview({
  capture,
  media,
  onMedia,
  onDone,
}: {
  capture: Capture
  /** Photos/documents picked in the capture bar - attached to the entry once it's saved. */
  media: PendingMedia[]
  onMedia: (update: (p: PendingMedia[]) => PendingMedia[]) => void
  /** Saved (what it became) or cancelled (null); `followUp`: other words to capture next. */
  onDone: (saved: SavedNotice | null, followUp?: string | null) => void
}) {
  const c = useColors()
  const { zone } = useAuth()
  const proposal = entryProposal(capture)!
  const [state, setState] = useState<Stored>(() => {
    const kept = entryDrafts.load(capture.id) as Stored | null
    return kept && kept.base === proposal.id
      ? kept
      : { base: proposal.id, form: formFromProposal(proposal, zone.timeZone), changed: [], proposals: [], unrelated: [] }
  })
  const { form, changed, proposals, unrelated } = state
  useEffect(() => entryDrafts.save(capture.id, state), [capture.id, state])
  const [clarifications, setClarifications] = useState<string[]>(proposal.clarification ? [proposal.clarification] : [])
  const [showTranscript, setShowTranscript] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The form as it was when the last words were sent - what the AI's answer is compared with.
  const sent = useRef<ItemForm | null>(null)
  const settings = useQuery({ queryKey: ['settings', 'recordings'], queryFn: settingsApi.recordings })
  const queryClient = useQueryClient()
  const [keepChoice, setKeepChoice] = useState<boolean | null>(null)
  const hasRecording = capture.source === 'Voice' && capture.audioParts > 0
  const keepRecording = keepChoice ?? settings.data?.keepRecordings ?? true

  const set = (patch: Partial<ItemForm>) =>
    setState((x) => ({ ...x, form: { ...x.form, ...patch }, changed: x.changed.filter((k) => !(k in patch)) }))

  // "Change it by voice or text": the AI's version fills the form, changed fields are marked.
  const onResult = (result: Capture) => {
    const known = new Set([proposal.id, ...proposals.map((p) => p.id)])
    const fresh = result.items.filter((i) => i.status === 'PendingReview' && i.heldByEditForm && !known.has(i.id))
    setState((x) => {
      let next = x.form
      const marks = new Set(x.changed)
      for (const p of fresh) {
        const applied = applyProposal(next, sent.current ?? x.form, p, zone.timeZone)
        next = applied.form
        applied.changed.forEach((k) => marks.add(k))
      }
      return {
        ...x,
        form: next,
        changed: [...marks],
        proposals: [...x.proposals, ...fresh],
        unrelated: [...x.unrelated, ...fresh.filter((p) => p.unrelated).map((p) => ({ text: p.unrelated!, capture: true }))],
      }
    })
    setClarifications(fresh.map((p) => p.clarification).filter((x): x is string => !!x))
  }

  const problems = formProblems(form)
  const save = async () => {
    if (busy || problems.length) return
    setBusy(true)
    setError(null)
    try {
      const saved = await saveReviewForm(api, {
        captureId: capture.id,
        itemId: proposal.id,
        form,
        tz: zone.timeZone,
        proposals,
        keepRecording: !hasRecording || keepRecording,
      })
      entryDrafts.clear(capture.id)
      // The new entry shows in the feed, Today and the calendar at once.
      void queryClient.invalidateQueries()
      onDone(savedNotice(saved, 1), unrelated.filter((u) => u.capture).map((u) => u.text).join(' ') || null)
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }
  const cancel = async () => {
    setBusy(true)
    try {
      await discardReviewForm(api, capture.id, proposal.id, proposals, form, zone.timeZone)
    } catch {
      // left pending at worst - the "unsaved review" banner offers it again
    }
    entryDrafts.clear(capture.id)
    void queryClient.invalidateQueries({ queryKey: ['captures'] }) // the unsaved-review banner
    onDone(null)
  }

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.accent }]}>
      <Text style={{ color: c.muted }}>{t('review.understood')}</Text>
      <Text style={[styles.title, { color: c.text }]}>{capture.title}</Text>
      <Pressable onPress={() => setShowTranscript((v) => !v)} accessibilityRole="button">
        <Text style={{ color: c.muted }}>
          {showTranscript ? '▾' : I18nManager.isRTL ? '◂' : '▸'} {capture.source === 'Voice' ? t('capture.fullTranscription') : t('capture.whatYouTyped')}
        </Text>
      </Pressable>
      {showTranscript && <Text style={[styles.transcript, { color: c.text, borderColor: c.border }]}>{capture.inputText}</Text>}

      {clarifications.map((x) => (
        <View key={x} style={styles.row}>
          <Ionicons name="help-circle-outline" size={18} color={c.warn} />
          <Text style={{ color: c.warn, flex: 1 }}>{x}</Text>
        </View>
      ))}

      <View style={[styles.section, { borderBottomColor: c.border }]}>
        <View style={styles.row}>
          <Ionicons name="mic-outline" size={18} color={c.text} />
          <Text style={{ color: c.text, fontWeight: '600', flex: 1 }}>{t('form.addByVoice')}</Text>
        </View>
        <CaptureBar
          continueFrom={{
            captureId: capture.id,
            onResult,
            itemState: () => {
              sent.current = form
              return formAsAiItem(form, zone.timeZone)
            },
          }}
        />
        {changed.length > 0 && (
          <View style={styles.row}>
            <Ionicons name="sparkles" size={14} color={c.accent} />
            <Text style={{ color: c.accent, fontSize: 13, flex: 1 }}>{t('form.aiFilled')}</Text>
          </View>
        )}
        {unrelated.map((u, i) => (
          <Pressable
            key={i}
            onPress={() => setState((x) => ({ ...x, unrelated: x.unrelated.map((y, j) => (j === i ? { ...y, capture: !y.capture } : y)) }))}
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: u.capture }}>
            <Ionicons name={u.capture ? 'checkbox' : 'square-outline'} size={20} color={c.accent} />
            <Text style={{ color: c.text, flex: 1 }}>{t('review.captureUnrelated', { text: u.text })}</Text>
          </Pressable>
        ))}
      </View>

      <View style={s.form}>
        <ItemFields
          form={form}
          set={set}
          setType={(type) => setState((x) => ({ ...x, form: switchType(x.form, type, zone.timeZone), changed: x.changed.filter((k) => k !== 'type') }))}
          changed={changed}
        />
        <MediaEditor pending={media} onPending={onMedia} />
        {hasRecording && (
          <View style={[styles.recording, { borderTopColor: c.border }]}>
            <Text style={{ color: c.text, fontWeight: '600' }}>{t('form.recording')}</Text>
            <RecordingPlayer captureId={capture.id} parts={capture.audioParts} />
            <Pressable
              onPress={() => setKeepChoice(!keepRecording)}
              style={styles.row}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: keepRecording }}>
              <Ionicons name={keepRecording ? 'checkbox' : 'square-outline'} size={22} color={c.accent} />
              <Text style={{ color: c.text }}>{t('review.keepRecording')}</Text>
            </Pressable>
          </View>
        )}
        {problems.length > 0 && <Text style={{ color: c.danger }}>{problems.join(' ')}</Text>}
        {error && <Text style={{ color: c.danger }}>{error}</Text>}
        <View style={s.actions}>
          <Button title={t('common.cancel')} disabled={busy} onPress={() => void cancel()} />
          <Button title={t('common.save')} variant="primary" busy={busy} disabled={problems.length > 0} onPress={() => void save()} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  title: { fontSize: 20, fontWeight: '700' },
  // A quote (a line at its side), not a box inside the card.
  transcript: { paddingVertical: 2, paddingLeft: 10, borderLeftWidth: 3, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  section: { gap: 8, borderBottomWidth: 1, paddingBottom: 12 },
  recording: { gap: 8, borderTopWidth: 1, paddingTop: 12 },
})
