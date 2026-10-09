import Ionicons from '@expo/vector-icons/Ionicons'
import { reviewItems } from '@shared/captureDraft'
import { KIND_LABEL } from '@shared/feed'
import { t } from '@shared/i18n'
import {
  applyProposal,
  discardProposals,
  formChanged,
  formProblems,
  formAsAiItem,
  SaveConflict,
  saveItemForm,
  switchType,
  type FormField,
  type ItemForm,
  type MergedProposal,
} from '@shared/itemForm'
import type { AppendTarget, Capture, ItemType } from '@shared/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { api, capturesApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { applyMedia, type PendingMedia } from '@/lib/media'
import { editDrafts } from '@/lib/reviewDrafts'
import { useColors } from '@/theme'
import { CaptureBar } from './CaptureBar'
import { detailStyles as s } from './detail'
import { MediaEditor } from './ItemMedia'
import { RecordingPlayer } from './SourceCapture'
import { ItemFields } from './ItemFields'
import { Button } from './ui'

const DETAIL_KEY = { Task: 'task', Appointment: 'appointment', Note: 'note' } as const

/** Whether there are unsaved changes to this item (the view says so). */
export const hasEditDraft = (id: string, saved: ItemForm) => !!loadDraft(id, saved)

/** What the form keeps on the device while editing (closing the app and coming back restores it). */
interface Draft {
  saved: ItemForm
  form: ItemForm
  changed: FormField[]
  proposals: MergedProposal[]
  unrelated: { text: string; capture: boolean }[]
  deleteRecording: boolean
  /** Attachments to remove on Save (picked files aren't kept here - only while the screen is open). */
  removeMedia?: string[]
}

function loadDraft(id: string, saved: ItemForm): Draft | null {
  const draft = editDrafts.load(id) as Draft | null
  // Only if the item hasn't changed since (another device).
  return draft && JSON.stringify(draft.saved) === JSON.stringify(saved) ? draft : null
}

/**
 * An item's Edit screen - everything that changes an item happens here (user's
 * call): the fields, its type, changing it by voice or text (the AI fills the
 * fields; the ones it changed are marked), deleting the recording. Nothing is
 * saved until Save; Cancel drops it all, including what the AI proposed.
 * Same as the web's ItemEditor.
 */
export function ItemEditor({
  item,
  saved,
  captureId,
  talkSignal,
  onDone,
}: {
  item: { itemType: ItemType; id: string; title: string }
  /** The item as saved, as a form. */
  saved: ItemForm
  /** The capture it came from (null: made by hand - one is made when something is said). */
  captureId: string | null
  /** Each new value starts recording (the floating mic, or opened with it). */
  talkSignal: number
  /** `moved`: the type changed, so it has a new id. `followUp`: words to capture as a new entry. */
  onDone: (result: { moved?: { itemType: ItemType; id: string }; followUp?: string } | null) => void
}) {
  const c = useColors()
  const { zone } = useAuth()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Draft>(
    () => loadDraft(item.id, saved) ?? { saved, form: saved, changed: [], proposals: [], unrelated: [], deleteRecording: false },
  )
  const { form, changed, proposals, unrelated, deleteRecording } = draft
  const removeMedia = draft.removeMedia ?? []
  // Photos/documents picked here: uploaded on Save.
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clarifications, setClarifications] = useState<string[]>([])
  const resolvedCapture = useRef<string | null>(captureId)
  // A type change went through but the rest of Save failed: Save carries on with the new item.
  const [current, setCurrent] = useState(item)
  // A type change keeps the id (one kind of item underneath) but not the page: it moved.
  const isMoved = (r: { itemType: ItemType; id: string }) => r.id !== item.id || r.itemType !== item.itemType
  // The form as it was when the last words were sent - what the AI's answer is compared with.
  const sent = useRef<ItemForm | null>(null)
  // Save stopped: the item was changed somewhere else meanwhile.
  const [conflict, setConflict] = useState(false)
  // The capture whose recording the form plays - also one made on the first addition to an item made by hand.
  const [captureRef, setCaptureRef] = useState<string | null>(captureId)
  const capture = useQuery({ queryKey: ['capture', captureRef], queryFn: () => capturesApi.get(captureRef!), enabled: !!captureRef })
  // Voice was just added: the recording plays it already, but it's only kept on Save.
  const [addedVoice, setAddedVoice] = useState(false)

  const dirty = formChanged(form, saved) || proposals.length > 0 || deleteRecording || removeMedia.length > 0 || pendingMedia.length > 0

  // Opened without a stored draft: additions from a draft that was lost (another
  // browser's storage cleared, app reinstalled) would stay pending for ever - drop them.
  const cleared = useRef(false)
  useEffect(() => {
    if (cleared.current || !capture.data) return
    cleared.current = true
    const mine = new Set(draft.proposals.map((p) => p.item.id))
    const lost = capture.data.items.filter(
      (i) => i.status === 'PendingReview' && i.heldByEditForm && i.continuesItemId === item.id && !mine.has(i.id),
    )
    if (lost.length) void discardProposals(api, lost.map((i) => ({ captureId: capture.data!.id, item: i }))).catch(() => {})
  }, [capture.data, draft.proposals, item.id])
  useEffect(() => (dirty ? editDrafts.save(item.id, draft) : editDrafts.clear(item.id)), [item.id, draft, dirty])

  const set = (patch: Partial<ItemForm>) =>
    setDraft((d) => ({ ...d, form: { ...d.form, ...patch }, changed: d.changed.filter((k) => !(k in patch)) }))

  // What was said or typed: the AI's version of the item fills the form.
  const onResult = (result: Capture) => {
    const target: AppendTarget = { itemType: item.itemType, itemId: item.id, title: item.title }
    const fresh = reviewItems(result, target).filter((i) => !draft.proposals.some((p) => p.item.id === i.id))
    setDraft((d) => {
      let next = d.form
      const marks = new Set(d.changed)
      for (const proposal of fresh) {
        const applied = applyProposal(next, sent.current ?? d.form, proposal, zone.timeZone)
        next = applied.form
        applied.changed.forEach((k) => marks.add(k))
      }
      return {
        ...d,
        form: next,
        changed: [...marks],
        proposals: [...d.proposals, ...fresh.map((p) => ({ captureId: result.id, item: p }))],
        unrelated: [...d.unrelated, ...fresh.filter((p) => p.unrelated).map((p) => ({ text: p.unrelated!, capture: true }))],
      }
    })
    setClarifications(fresh.map((p) => p.clarification).filter((x): x is string => !!x))
    resolvedCapture.current = result.id
    // Before Save, hear the whole recording - the earlier parts and the one just added
    // (the server joins it on at once; Cancel takes it back out).
    if (result.audioParts > (capture.data?.audioParts ?? 0)) setAddedVoice(true)
    queryClient.setQueryData(['capture', result.id], result)
    setCaptureRef(result.id)
  }

  const problems = formProblems(form)
  const save = async (force = false) => {
    if (busy || problems.length) return
    setBusy(true)
    setError(null)
    setConflict(false)
    try {
      const result = await saveItemForm(api, {
        item: { itemType: current.itemType, id: current.id },
        form,
        // As it was when editing started (the page's copy refreshes under the form).
        saved: draft.saved,
        // After a half-done type change the item is new (and differs from `saved` by design).
        force: force || isMoved(current),
        tz: zone.timeZone,
        proposals,
        deleteRecordingOf: deleteRecording ? captureRef : null,
        media:
          pendingMedia.length || removeMedia.length
            ? (target) =>
                applyMedia(target, pendingMedia, removeMedia, {
                  removed: () => setDraft((d) => ({ ...d, removeMedia: [] })),
                  uploaded: (key) => setPendingMedia((p) => p.filter((x) => x.key !== key)),
                })
            : undefined,
      })
      editDrafts.clear(item.id)
      // The recording is gone: don't let the item's page fetch it from the stale capture (404s).
      if (deleteRecording && captureRef) queryClient.setQueryData<Capture>(['capture', captureRef], (c) => c && { ...c, audioParts: 0 })
      // The old item is gone after a type change: refresh everything but it (it would 404).
      const gone = isMoved(result) ? [DETAIL_KEY[item.itemType], item.id] : null
      void queryClient.invalidateQueries({ predicate: (q) => !gone || q.queryKey[0] !== gone[0] || q.queryKey[1] !== gone[1] })
      const followUp = unrelated.filter((u) => u.capture).map((u) => u.text).join(' ') || undefined
      onDone({ moved: isMoved(result) ? result : undefined, followUp })
    } catch (err) {
      setBusy(false)
      if (err instanceof SaveConflict) {
        setConflict(true)
        return
      }
      const moved = (err as { moved?: { itemType: ItemType; id: string } }).moved
      if (moved) setCurrent({ ...moved, title: item.title })
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const cancel = async () => {
    setBusy(true)
    await discardProposals(api, proposals).catch(() => {}) // left pending at worst - cleared next time Edit opens
    editDrafts.clear(item.id)
    // Reload the item (after "Discard my changes" the page's copy is stale).
    const gone = isMoved(current) ? [DETAIL_KEY[item.itemType], item.id] : null
    await queryClient.invalidateQueries({ predicate: (q) => !gone || q.queryKey[0] !== gone[0] || q.queryKey[1] !== gone[1] })
    // A type change already went through: the item is the new one now.
    onDone(isMoved(current) ? { moved: { itemType: current.itemType, id: current.id } } : null)
  }

  const recording = capture.data && capture.data.source === 'Voice' && capture.data.audioParts > 0 ? capture.data : null

  return (
    <View style={s.form}>
      {/* Say or type a change: the AI fills the fields below. First, so talking is what you see. */}
      <View style={[styles.section, styles.voiceFirst, { borderBottomColor: c.border }]}>
        <View style={styles.sectionHead}>
          <Ionicons name="mic-outline" size={18} color={c.text} />
          <Text style={{ color: c.text, fontWeight: '600', flex: 1 }}>{t('form.addByVoice')}</Text>
        </View>
        <Text style={{ color: c.muted, fontSize: 13 }}>{t('form.addHint')}</Text>
        <CaptureBar
          continueFrom={{
            captureId:
              captureId ??
              (async () => resolvedCapture.current ?? (resolvedCapture.current = (await capturesApi.forItem(item.itemType, item.id)).id)),
            target: { itemType: item.itemType, itemId: item.id, title: item.title },
            onResult,
            itemState: () => {
              sent.current = form
              return formAsAiItem(form, zone.timeZone)
            },
            talkSignal,
          }}
        />
        {changed.length > 0 && (
          <View style={styles.sectionHead}>
            <Ionicons name="sparkles" size={14} color={c.accent} />
            <Text style={{ color: c.accent, fontSize: 13, flex: 1 }}>{t('form.aiFilled')}</Text>
          </View>
        )}
        {clarifications.map((x) => (
          <Text key={x} style={{ color: c.warn, fontSize: 14 }}>
            {x}
          </Text>
        ))}
        {unrelated.map((u, i) => (
          <Pressable
            key={i}
            onPress={() => setDraft((d) => ({ ...d, unrelated: d.unrelated.map((x, j) => (j === i ? { ...x, capture: !x.capture } : x)) }))}
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: u.capture }}>
            <Ionicons name={u.capture ? 'checkbox' : 'square-outline'} size={20} color={c.accent} />
            <Text style={{ color: c.text, flex: 1 }}>{t('review.captureUnrelated', { text: u.text })}</Text>
          </Pressable>
        ))}
      </View>

      <ItemFields
        form={form}
        set={set}
        setType={(type) => setDraft((d) => ({ ...d, form: switchType(d.form, type, zone.timeZone), changed: d.changed.filter((k) => k !== 'type') }))}
        changed={changed}
        afterType={
          form.type !== item.itemType && (
            <Text style={{ color: c.warn, fontWeight: '600' }}>{t('review.typeChange', { from: KIND_LABEL[item.itemType], to: KIND_LABEL[form.type] })}</Text>
          )
        }
      />

      <MediaEditor
        itemType={current.itemType}
        id={current.id}
        pending={pendingMedia}
        onPending={setPendingMedia}
        removed={removeMedia}
        onRemoved={(ids) => setDraft((d) => ({ ...d, removeMedia: ids }))}
      />

      {recording && captureRef && (
        <View style={[styles.section, { borderTopColor: c.border }]}>
          <Text style={{ color: c.text, fontWeight: '600' }}>{t('form.recording')}</Text>
          {deleteRecording ? (
            <View style={styles.sectionHead}>
              <Text style={{ color: c.muted, flex: 1 }}>{t('form.recordingWillBeDeleted')}</Text>
              <Button title={t('common.undo')} variant="link" onPress={() => setDraft((d) => ({ ...d, deleteRecording: false }))} />
            </View>
          ) : (
            <>
              <RecordingPlayer captureId={captureRef} parts={recording.audioParts} />
              {addedVoice && <Text style={{ color: c.muted, fontSize: 13 }}>{t('form.recordingAddedNotSaved')}</Text>}
              <Button title={t('source.deleteAudio')} variant="danger" onPress={() => setDraft((d) => ({ ...d, deleteRecording: true }))} />
            </>
          )}
        </View>
      )}

      {problems.length > 0 && dirty && <Text style={{ color: c.danger }}>{problems.join(' ')}</Text>}
      {conflict && (
        <View style={[styles.section, { borderTopColor: c.warn }]} accessibilityRole="alert">
          <Text style={{ color: c.warn }}>{t('form.conflict')}</Text>
          <View style={s.actions}>
            <Button title={t('form.saveAnyway')} variant="primary" onPress={() => void save(true)} />
            <Button title={t('form.discardMine')} onPress={() => void cancel()} />
          </View>
        </View>
      )}
      {error && <Text style={{ color: c.danger }}>{error}</Text>}
      <View style={s.actions}>
        <Button title={t('common.cancel')} disabled={busy} onPress={() => void cancel()} />
        <Button title={t('item.saveChanges')} variant="primary" busy={busy} disabled={problems.length > 0} onPress={() => void save()} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  section: { gap: 8, borderTopWidth: 1, paddingTop: 12 },
  voiceFirst: { borderTopWidth: 0, paddingTop: 0, borderBottomWidth: 1, paddingBottom: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
})
