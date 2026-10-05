import Ionicons from '@expo/vector-icons/Ionicons'
import { itemClips } from '@shared/audioSnippet'
import { reviewItems } from '@shared/captureDraft'
import { endsNextDay } from '@shared/dates'
import { KIND_LABEL } from '@shared/feed'
import { t } from '@shared/i18n'
import {
  applyProposal,
  discardProposals,
  formChanged,
  formHasTime,
  formProblems,
  saveItemForm,
  switchType,
  type FormField,
  type ItemForm,
  type MergedProposal,
} from '@shared/itemForm'
import { priorityLabel } from '@shared/labels'
import type { AppendTarget, Capture, ItemType, TaskPriority } from '@shared/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { api, capturesApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { openDock } from '@/lib/dockTarget'
import { editDrafts } from '@/lib/reviewDrafts'
import { useColors } from '@/theme'
import { CaptureBar } from './CaptureBar'
import { DateTimeField } from './DateTimeField'
import { CycleChip, detailStyles as s, Field } from './detail'
import { KIND_ICON } from './kindIcons'
import { ReminderList } from './ReminderList'
import { RecordingPlayer } from './SourceCapture'
import { Button } from './ui'

const TYPES: ItemType[] = ['Task', 'Appointment', 'Note']
const PRIORITIES: TaskPriority[] = ['None', 'Low', 'Medium', 'High']
const DETAIL_KEY = { Task: 'task', Appointment: 'appointment', Note: 'note' } as const

/** What the form keeps on the device while editing (closing the app and coming back restores it). */
interface Draft {
  saved: ItemForm
  form: ItemForm
  changed: FormField[]
  proposals: MergedProposal[]
  unrelated: { text: string; capture: boolean }[]
  deleteRecording: boolean
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clarifications, setClarifications] = useState<string[]>([])
  const resolvedCapture = useRef<string | null>(captureId)
  const capture = useQuery({ queryKey: ['capture', captureId], queryFn: () => capturesApi.get(captureId!), enabled: !!captureId })

  const dirty = formChanged(form, saved) || proposals.length > 0 || deleteRecording
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
        const applied = applyProposal(next, d.saved, proposal, zone.timeZone)
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
  }

  const problems = formProblems(form)
  const save = async () => {
    if (busy || problems.length) return
    setBusy(true)
    setError(null)
    try {
      const result = await saveItemForm(api, {
        item: { itemType: item.itemType, id: item.id },
        form,
        tz: zone.timeZone,
        proposals,
        deleteRecordingOf: deleteRecording ? captureId : null,
      })
      editDrafts.clear(item.id)
      // The old item is gone after a type change: refresh everything but it (it would 404).
      const gone = result.id !== item.id ? [DETAIL_KEY[item.itemType], item.id] : null
      void queryClient.invalidateQueries({ predicate: (q) => !gone || q.queryKey[0] !== gone[0] || q.queryKey[1] !== gone[1] })
      const followUp = unrelated.filter((u) => u.capture).map((u) => u.text).join(' ') || undefined
      onDone({ moved: result.id !== item.id ? result : undefined, followUp })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      setBusy(false)
    }
  }

  const cancel = async () => {
    setBusy(true)
    await discardProposals(api, proposals).catch(() => {}) // left pending at worst - the banner offers it
    editDrafts.clear(item.id)
    if (proposals.length) await queryClient.invalidateQueries()
    onDone(null)
  }

  const isNote = form.type === 'Note'
  const marked = (key: FormField) => changed.includes(key)
  const recording = capture.data && capture.data.source === 'Voice' && capture.data.audioParts > 0 ? capture.data : null
  const ring = (key: FormField) => (marked(key) ? { borderWidth: 2, borderColor: c.accent, borderRadius: 12, padding: 4 } : null)

  return (
    <View style={s.form}>
      {/* Say or type a change: the AI fills the fields below. First, so talking is what you see. */}
      <View style={[styles.section, styles.voiceFirst, { borderBottomColor: c.border }]}>
        <View style={styles.sectionHead}>
          <Ionicons name="mic-outline" size={18} color={c.text} />
          <Text style={{ color: c.text, fontWeight: '600', flex: 1 }}>{t('form.addByVoice')}</Text>
          <Button title={t('form.newEntryInstead')} variant="link" onPress={openDock} />
        </View>
        <Text style={{ color: c.muted, fontSize: 13 }}>{t('form.addHint')}</Text>
        <CaptureBar
          continueFrom={{
            captureId:
              captureId ??
              (async () => resolvedCapture.current ?? (resolvedCapture.current = (await capturesApi.forItem(item.itemType, item.id)).id)),
            target: { itemType: item.itemType, itemId: item.id, title: item.title },
            onResult,
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

      <View style={[styles.chips, ring('type')]} accessibilityRole="radiogroup" accessibilityLabel={t('changeType.label')}>
        {TYPES.map((type) => {
          const selected = form.type === type
          return (
            <Pressable
              key={type}
              onPress={() => setDraft((d) => ({ ...d, form: switchType(d.form, type, zone.timeZone), changed: d.changed.filter((k) => k !== 'type') }))}
              style={[styles.chip, { borderColor: selected ? c.accent : c.border, backgroundColor: selected ? c.surface2 : c.surface }]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}>
              <Ionicons name={KIND_ICON[type]} size={16} color={selected ? c.text : c.muted} />
              <Text style={{ color: selected ? c.text : c.muted }}>{KIND_LABEL[type]}</Text>
            </Pressable>
          )
        })}
      </View>
      {form.type !== item.itemType && (
        <Text style={{ color: c.warn, fontWeight: '600' }}>{t('review.typeChange', { from: KIND_LABEL[item.itemType], to: KIND_LABEL[form.type] })}</Text>
      )}

      <Field
        label={isNote ? `${t('item.title')} (${t('item.optional')})` : t('item.title')}
        value={form.title}
        onChangeText={(title) => set({ title })}
        changed={marked('title')}
      />

      {form.type !== 'Note' && (
        <View style={[s.chips, ring('date') ?? ring('time') ?? ring('endTime')]}>
          <DateTimeField
            mode="date"
            value={form.date || null}
            onChange={(date) => set({ date: date ?? '' })}
            placeholder={form.type === 'Task' ? t('task.dueDate') : t('item.date')}
            disabled={form.type === 'Task' && form.ongoing}
          />
          <DateTimeField
            mode="time"
            value={form.time || null}
            onChange={(time) => set({ time: time ?? '' })}
            placeholder={form.type === 'Task' ? t('item.time') : t('event.start')}
            date={form.date || null}
            disabled={form.type === 'Task' && (form.ongoing || !form.date)}
          />
          {form.type === 'Appointment' && (
            <DateTimeField
              mode="time"
              value={form.endTime || null}
              onChange={(endTime) => set({ endTime: endTime ?? '' })}
              placeholder={t('event.end')}
              date={form.date || null}
              prefix={t('event.until')}
            />
          )}
        </View>
      )}
      {form.type === 'Appointment' && endsNextDay(form.time, form.endTime) && (
        <Text style={{ color: c.warn, fontSize: 13 }}>{t('event.endsNextDay')}</Text>
      )}

      {form.type === 'Task' && (
        <View style={[s.chips, ring('priority')]}>
          <CycleChip
            values={PRIORITIES}
            value={form.priority}
            onChange={(priority) => set({ priority })}
            label={(p) => (p === 'None' ? t('task.noPriority') : t('task.priorityBadge', { priority: priorityLabel(p) }))}
            highlight={(p) => p !== 'None'}
          />
          <CycleChip
            values={[false, true]}
            value={form.ongoing}
            onChange={(ongoing) => set({ ongoing })}
            label={(o) => (o ? `${t('today.ongoing')} ✓` : t('today.ongoing'))}
            highlight={(o) => o}
          />
        </View>
      )}
      {form.type === 'Appointment' && (
        <>
          <Field label={t('event.location')} value={form.location} onChangeText={(location) => set({ location })} changed={marked('location')} />
          <Field
            label={`${t('event.with')} ${t('item.commaSeparated')}`}
            value={form.people}
            onChangeText={(people) => set({ people })}
            changed={marked('people')}
          />
        </>
      )}

      <View style={ring('reminders')}>
        <ReminderList value={form.reminders} onChange={(reminders) => set({ reminders })} itemHasTime={formHasTime(form)} isNote={isNote} />
      </View>
      {form.type === 'Task' && (
        <Field
          label={`${t('task.tags')} ${t('item.commaSeparated')}`}
          value={form.tags}
          onChangeText={(tags) => set({ tags })}
          autoCapitalize="none"
          changed={marked('tags')}
        />
      )}
      <Field
        label={isNote ? t('kind.note') : t('item.description')}
        value={form.details}
        onChangeText={(details) => set({ details })}
        multiline
        changed={marked('details')}
      />
      {!isNote && <Field label={t('item.notes')} value={form.notes} onChangeText={(notes) => set({ notes })} multiline changed={marked('notes')} />}

      {recording && captureId && (
        <View style={[styles.section, { borderTopColor: c.border }]}>
          <Text style={{ color: c.text, fontWeight: '600' }}>{t('form.recording')}</Text>
          {deleteRecording ? (
            <View style={styles.sectionHead}>
              <Text style={{ color: c.muted, flex: 1 }}>{t('form.recordingWillBeDeleted')}</Text>
              <Button title={t('common.undo')} variant="link" onPress={() => setDraft((d) => ({ ...d, deleteRecording: false }))} />
            </View>
          ) : (
            <>
              <RecordingPlayer
                captureId={captureId}
                parts={recording.audioParts}
                durationsMs={recording.audioPartDurationsMs ?? null}
                clips={itemClips(recording, { itemType: item.itemType, itemId: item.id, title: item.title })}
              />
              <Button title={t('source.deleteAudio')} variant="danger" onPress={() => setDraft((d) => ({ ...d, deleteRecording: true }))} />
            </>
          )}
        </View>
      )}

      {problems.length > 0 && dirty && <Text style={{ color: c.danger }}>{problems.join(' ')}</Text>}
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
