import Ionicons from '@expo/vector-icons/Ionicons'
import { draftHasTime, draftProblems, followUpText, INTENT_OPTIONS, toConfirmItem, movedItem, reviewItems, suggestedTitle, toDraft, typeChange, updatesWholeItem, type ItemDraft } from '@shared/captureDraft'
import { endsNextDay } from '@shared/dates'
import { KIND_LABEL } from '@shared/feed'
import type { AppendTarget, Capture, ExtractionIntent, TaskPriority, ItemType } from '@shared/types'
import { useEffect, useRef, useState } from 'react'
import { restoreDrafts } from '@shared/pendingReview'
import { reviewDrafts } from '@/lib/reviewDrafts'
import { I18nManager, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { capturesApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { useAction } from '@/lib/useAction'
import { useColors, type Colors } from '@/theme'
import { DateTimeField } from './DateTimeField'
import { ReminderList } from './ReminderList'
import { Button } from './ui'
import { t } from '@shared/i18n'
import { priorityLabel } from '@shared/labels'

const DETAIL_KEY = { Task: 'task', Appointment: 'appointment', Note: 'note' } as const

/** A whole-item update to another type: the item gets a new id and the old one is deleted. */
const movesItem = (i: ReturnType<typeof toConfirmItem>, target: AppendTarget) =>
  i.include && i.replacesItem && (i.intent === 'Appointment' ? 'Appointment' : i.intent === 'Note' ? 'Note' : 'Task') !== target.itemType

const PRIORITIES: (TaskPriority | null)[] = [null, 'Low', 'Medium', 'High']
const ADD_TO = { Task: 'review.addToTask', Appointment: 'review.addToEvent', Note: 'review.addToNote' } as const
const intentColor = (intent: ExtractionIntent, c: Colors) =>
  intent === 'Appointment' ? c.appointment : intent === 'Reminder' ? c.warn : intent === 'Note' ? c.muted : c.task

/**
 * "I understood:" (spec section 18). Every property is editable; only switched-on
 * items are saved, and only when the user presses Save.
 */
export function CaptureReview({
  capture,
  onDone,
  appendTarget,
  onMoved,
}: {
  capture: Capture
  /** `followUp`: words to capture as a new entry next (said in "Add more" but not about the item). */
  onDone: (message: string | null, followUp?: string | null) => void
  /** Reviewing a continued capture: offer "Add to this <item>". */
  appendTarget?: AppendTarget
  /** The item's type was changed, so it has a new id. */
  onMoved?: (item: { itemType: ItemType; itemId: string }) => void
}) {
  const c = useColors()
  const { zone } = useAuth()
  const confirm = useAction((items: ReturnType<typeof toConfirmItem>[]) => capturesApi.confirm(capture.id, items), {
    // A type change replaces the item: drop its screen's query instead of refetching a deleted item (404).
    forget: (items) => (appendTarget && items.some((i) => movesItem(i, appendTarget)) ? [DETAIL_KEY[appendTarget.itemType], appendTarget.itemId] : ['none']),
  })
  // Edits are kept on the device until Save / Cancel, so Resume brings them back.
  const [drafts, setDrafts] = useState<ItemDraft[]>(() =>
    restoreDrafts(reviewDrafts.load(capture.id), reviewItems(capture, appendTarget).map((i) => toDraft(i, zone.timeZone, appendTarget))),
  )
  useEffect(() => reviewDrafts.save(capture.id, drafts), [capture.id, drafts])
  // One confirm at a time: a double tap must not send a second one before the button disables.
  const sending = useRef(false)
  const [showTranscript, setShowTranscript] = useState(false)

  const update = (id: string, patch: Partial<ItemDraft>) =>
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)))

  const included = drafts.filter((d) => d.include)
  const blocked = drafts.some((d) => draftProblems(d).length > 0)

  // The awaited result, not a mutate() callback: saving refreshes the item's
  // page, and when its type changed that page unmounts this review first -
  // which drops mutate() callbacks, but never the promise.
  const save = () => {
    if (sending.current) return
    sending.current = true
    confirm
      .mutateAsync(drafts.map((d) => toConfirmItem(d, zone.timeZone, appendTarget)))
      .then((saved) => {
        reviewDrafts.clear(capture.id)
        onDone(included.length ? t('review.saved', { count: included.length }) : null, followUpText(drafts))
        const moved = movedItem(drafts, saved, appendTarget)
        if (moved) onMoved?.(moved)
      })
      .catch(() => {}) // shown from confirm.error
      .finally(() => (sending.current = false))
  }

  // Cancel rejects everything so the capture doesn't linger as pending.
  const discard = () =>
    drafts.length === 0
      ? onDone(null)
      : confirm.mutate(
          drafts.map((d) => toConfirmItem({ ...d, include: false }, zone.timeZone)),
          {
            onSuccess: () => {
              reviewDrafts.clear(capture.id)
              onDone(null)
            },
          },
        )

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.accent }]}>
      {appendTarget ? (
        // Continuing: the capture and its transcription are already shown around this.
        <Text style={{ color: c.muted }}>{t('review.understoodAddition')}</Text>
      ) : (
        <>
          <Text style={{ color: c.muted }}>{t('review.understood')}</Text>
          <Text style={[styles.title, { color: c.text }]}>{capture.title}</Text>
          {capture.summary && <Text style={{ color: c.text }}>{capture.summary}</Text>}
          <Pressable onPress={() => setShowTranscript((s) => !s)} accessibilityRole="button">
            <Text style={{ color: c.muted }}>
              {showTranscript ? '▾' : I18nManager.isRTL ? '◂' : '▸'} {capture.source === 'Voice' ? t('capture.fullTranscription') : t('capture.whatYouTyped')}
            </Text>
          </Pressable>
          {showTranscript && (
            <Text style={[styles.transcript, { color: c.text, backgroundColor: c.surface2 }]}>{capture.inputText}</Text>
          )}
        </>
      )}

      {drafts.length === 0 ? (
        <Text style={{ color: c.muted }}>{t('review.nothing')}</Text>
      ) : (
        drafts.map((d) => <ItemEditor key={d.id} draft={d} onChange={(patch) => update(d.id, patch)} appendTarget={appendTarget} />)
      )}

      {confirm.error && <Text style={{ color: c.danger }}>{confirm.error.message}</Text>}
      <View style={styles.actions}>
        <Button title={t('common.cancel')} onPress={discard} disabled={confirm.isPending} />
        <Button
          title={included.length === drafts.length ? t('review.saveAll') : t('review.saveSome', { count: included.length })}
          variant="primary"
          onPress={save}
          busy={confirm.isPending}
          disabled={blocked || included.length === 0}
        />
      </View>
    </View>
  )
}

function ItemEditor({
  draft: d,
  onChange,
  appendTarget,
}: {
  draft: ItemDraft
  onChange: (patch: Partial<ItemDraft>) => void
  appendTarget?: AppendTarget
}) {
  const c = useColors()
  const problems = draftProblems(d)
  const isNote = d.intent === 'Note'
  const cycle = <T,>(list: T[], value: T) => list[(list.indexOf(value) + 1) % list.length]

  return (
    <View style={[styles.item, { borderColor: c.border, borderLeftColor: intentColor(d.intent, c), opacity: d.include ? 1 : 0.55 }]}>
      <View style={styles.row}>
        <Switch
          value={d.include}
          onValueChange={(include) => onChange({ include })}
          accessibilityLabel={d.include ? t('review.include') : t('review.excluded')}
          trackColor={{ true: c.accent }}
        />
        {updatesWholeItem(d) && appendTarget ? (
          // Updating the item continued from: its title stays - shown as text, not a field.
          <View style={styles.lockedTitle} accessibilityLabel={d.useNewTitle ? undefined : t('review.titleKept')}>
            <Text style={[styles.lockedTitleText, { color: c.text }, !d.include && styles.struck]}>
              {d.useNewTitle ? d.title : appendTarget.title}
            </Text>
            {!d.useNewTitle && <Ionicons name="lock-closed-outline" size={16} color={c.muted} />}
          </View>
        ) : (
          <TextInput
            style={[styles.itemTitle, { color: c.text, borderColor: c.border }, !d.include && styles.struck]}
            value={d.title}
            onChangeText={(title) => onChange({ title })}
            accessibilityLabel={t('item.title')}
          />
        )}
      </View>

      {d.include && (
        <>
          <View style={styles.chips}>
            {/* Any item can be any type (user's rule) - switching keeps the dates.
                A reminder isn't a type: every type has its own reminder chip. */}
            {appendTarget && !updatesWholeItem(d) && (
              // Continuing from an item: this can complete it instead of becoming a new one.
              <Pressable
                onPress={() => onChange(d.wholeItem ? { appendTo: true, intent: appendTarget.itemType } : { appendTo: true })}
                style={[styles.chip, { borderColor: d.appendTo ? c.accent : c.border }, d.appendTo && { backgroundColor: c.surface2 }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: d.appendTo }}
                accessibilityLabel={t('review.addToTitle', { title: appendTarget.title })}>
                <Text style={{ color: d.appendTo ? c.text : c.muted, fontSize: 13 }}>{t(ADD_TO[appendTarget.itemType])}</Text>
              </Pressable>
            )}
            {INTENT_OPTIONS.map(({ intent, label }) => {
              const selected = (!d.appendTo || d.wholeItem) && d.intent === intent
              return (
                <Pressable
                  key={intent}
                  // Updating the item: the chips pick its type (it stays the same item).
                  onPress={() => onChange(updatesWholeItem(d) ? { intent } : { intent, appendTo: false })}
                  style={[styles.chip, { borderColor: selected ? intentColor(intent, c) : c.border }, selected && { backgroundColor: c.surface2 }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}>
                  <Text style={{ color: selected ? c.text : c.muted, fontSize: 13 }}>{label}</Text>
                </Pressable>
              )
            })}
          </View>

          {updatesWholeItem(d) && appendTarget && (
            <Text style={{ color: c.muted, fontSize: 13 }}>{t(d.useNewTitle ? 'review.updatesItemRenamed' : 'review.updatesItem', { title: appendTarget.title })}</Text>
          )}
          {suggestedTitle(d, appendTarget) && (
            <Pressable
              onPress={() => onChange({ useNewTitle: !d.useNewTitle })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!d.useNewTitle }}>
              <Ionicons name={d.useNewTitle ? 'checkbox' : 'square-outline'} size={20} color={c.accent} />
              <Text style={{ color: c.text, flex: 1 }}>{t('review.useNewTitle', { title: suggestedTitle(d, appendTarget)! })}</Text>
            </Pressable>
          )}
          {typeChange(d, appendTarget) && (
            <Text style={{ color: c.warn, fontSize: 13, fontWeight: '600' }}>
              {t('review.typeChange', { from: KIND_LABEL[typeChange(d, appendTarget)!.from], to: KIND_LABEL[typeChange(d, appendTarget)!.to as ItemType] })}
            </Text>
          )}

          {(!d.appendTo || d.wholeItem) && (
            <View style={styles.stack}>
              {!isNote && (
                <View style={styles.chips}>
                  <DateTimeField mode="date" value={d.date} onChange={(date) => onChange({ date })} placeholder={t('item.date')} />
                  <DateTimeField
                    mode="time"
                    value={d.time}
                    onChange={(time) => onChange({ time })}
                    placeholder={d.intent === 'Appointment' ? t('event.start') : t('item.time')}
                    date={d.date}
                  />
                  {d.intent === 'Appointment' && (
                    <DateTimeField mode="time" value={d.endTime} onChange={(endTime) => onChange({ endTime })} placeholder={t('event.end')} date={d.date} prefix={t('event.until')} />
                  )}
                  {d.intent === 'Appointment' && endsNextDay(d.time, d.endTime) && (
                    <Text style={{ color: c.warn, fontSize: 13, alignSelf: 'center' }}>{t('event.endsNextDay')}</Text>
                  )}
                </View>
              )}

              {d.intent === 'Appointment' && (
                <TextInput
                  style={[styles.field, { color: c.text, borderColor: c.border }]}
                  placeholder={t('event.location')}
                  placeholderTextColor={c.muted}
                  value={d.location ?? ''}
                  onChangeText={(location) => onChange({ location: location || null })}
                />
              )}

              {d.intent === 'Task' && (
                <View style={styles.chips}>
                  <Pressable
                    onPress={() => onChange({ priority: cycle(PRIORITIES, d.priority) })}
                    style={[styles.chip, { borderColor: c.border }]}
                    accessibilityRole="button"
                    accessibilityLabel={t('task.priorityAria', { priority: priorityLabel(d.priority ?? 'None') })}>
                    <Text style={{ color: d.priority === 'High' ? c.danger : d.priority ? c.text : c.muted }}>
                      {d.priority ? t('task.priorityBadge', { priority: priorityLabel(d.priority) }) : t('task.noPriority')}
                    </Text>
                  </Pressable>
                </View>
              )}
              <ReminderList
                value={d.reminders}
                onChange={(reminders) => onChange({ reminders })}
                itemHasTime={draftHasTime(d)}
                isNote={isNote}
                showProblem={false}
              />
            </View>
          )}

          <TextInput
            style={[styles.field, styles.details, { color: c.text, borderColor: c.border }]}
            placeholder={d.appendTo && !d.wholeItem ? t('review.whatToAdd') : d.intent === 'Note' ? t('review.noteKeep') : t('review.detailsOptional')}
            placeholderTextColor={c.muted}
            multiline
            value={d.description ?? ''}
            onChangeText={(description) => onChange({ description: description || null })}
            accessibilityLabel={d.appendTo && !d.wholeItem ? t('capture.textToAdd') : d.intent === 'Note' ? t('review.noteText') : t('review.details')}
          />
          {d.unrelated && (
            // Words that weren't about this item: offered as a new entry, not dropped.
            <Pressable
              onPress={() => onChange({ captureUnrelated: !d.captureUnrelated })}
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: d.captureUnrelated }}>
              <Ionicons name={d.captureUnrelated ? 'checkbox' : 'square-outline'} size={20} color={c.accent} />
              <Text style={{ color: c.text, flex: 1 }}>{t('review.captureUnrelated', { text: d.unrelated })}</Text>
            </Pressable>
          )}
          {d.clarification && (
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
              <Ionicons name="help-circle-outline" size={18} color={c.warn} />
              <Text style={{ color: c.warn, fontSize: 14, flex: 1 }}>{d.clarification}</Text>
            </View>
          )}
        </>
      )}
      {problems.length > 0 && <Text style={{ color: c.danger, fontSize: 13 }}>{problems.join(' ')}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  lockedTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  lockedTitleText: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  title: { fontSize: 20, fontWeight: '700' },
  transcript: { padding: 10, borderRadius: 8, fontSize: 14, lineHeight: 20 },
  item: { borderWidth: 1, borderLeftWidth: 4, borderRadius: 12, padding: 10, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTitle: { flex: 1, fontSize: 16, fontWeight: '500', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, minHeight: 42 },
  struck: { textDecorationLine: 'line-through' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 36, justifyContent: 'center' },
  field: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 42, fontSize: 15 },
  details: { minHeight: 64, paddingVertical: 10, textAlignVertical: 'top' },
  stack: { gap: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
})
