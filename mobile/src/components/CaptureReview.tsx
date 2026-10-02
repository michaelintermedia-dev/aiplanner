import { draftHasTime, draftProblems, INTENT_OPTIONS, toConfirmItem, toDraft, type ItemDraft } from '@shared/captureDraft'
import type { AppendTarget, Capture, ExtractionIntent, TaskPriority } from '@shared/types'
import { useState } from 'react'
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
}: {
  capture: Capture
  onDone: (message: string | null) => void
  /** Reviewing a continued capture: offer "Add to this <item>". */
  appendTarget?: AppendTarget
}) {
  const c = useColors()
  const { zone } = useAuth()
  const confirm = useAction((items: ReturnType<typeof toConfirmItem>[]) => capturesApi.confirm(capture.id, items))
  const [drafts, setDrafts] = useState<ItemDraft[]>(() =>
    capture.items.filter((i) => i.status === 'PendingReview').map((i) => toDraft(i, zone.timeZone, !!appendTarget)),
  )
  const [showTranscript, setShowTranscript] = useState(false)

  const update = (id: string, patch: Partial<ItemDraft>) =>
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)))

  const included = drafts.filter((d) => d.include)
  const blocked = drafts.some((d) => draftProblems(d).length > 0)

  const save = () =>
    confirm.mutate(
      drafts.map((d) => toConfirmItem(d, zone.timeZone, appendTarget)),
      { onSuccess: () => onDone(included.length ? t('review.saved', { count: included.length }) : null) },
    )

  // Cancel rejects everything so the capture doesn't linger as pending.
  const discard = () =>
    drafts.length === 0
      ? onDone(null)
      : confirm.mutate(
          drafts.map((d) => toConfirmItem({ ...d, include: false }, zone.timeZone)),
          { onSuccess: () => onDone(null) },
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
          disabled={blocked || drafts.length === 0}
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
        <TextInput
          style={[styles.itemTitle, { color: c.text, borderColor: c.border }, !d.include && styles.struck]}
          value={d.title}
          onChangeText={(title) => onChange({ title })}
          accessibilityLabel={t('item.title')}
        />
      </View>

      {d.include && (
        <>
          <View style={styles.chips}>
            {/* Any item can be any type (user's rule) - switching keeps the dates.
                A reminder isn't a type: every type has its own reminder chip. */}
            {appendTarget && (
              // Continuing from an item: this can complete it instead of becoming a new one.
              <Pressable
                onPress={() => onChange({ appendTo: true })}
                style={[styles.chip, { borderColor: d.appendTo ? c.accent : c.border }, d.appendTo && { backgroundColor: c.surface2 }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: d.appendTo }}
                accessibilityLabel={t('review.addToTitle', { title: appendTarget.title })}>
                <Text style={{ color: d.appendTo ? c.text : c.muted, fontSize: 13 }}>{t(ADD_TO[appendTarget.itemType])}</Text>
              </Pressable>
            )}
            {INTENT_OPTIONS.map(({ intent, label }) => {
              const selected = !d.appendTo && d.intent === intent
              return (
                <Pressable
                  key={intent}
                  onPress={() => onChange({ intent, appendTo: false })}
                  style={[styles.chip, { borderColor: selected ? intentColor(intent, c) : c.border }, selected && { backgroundColor: c.surface2 }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}>
                  <Text style={{ color: selected ? c.text : c.muted, fontSize: 13 }}>{label}</Text>
                </Pressable>
              )
            })}
          </View>

          {!d.appendTo && (
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
            placeholder={d.appendTo ? t('review.whatToAdd') : d.intent === 'Note' ? t('review.noteKeep') : t('review.detailsOptional')}
            placeholderTextColor={c.muted}
            multiline
            value={d.description ?? ''}
            onChangeText={(description) => onChange({ description: description || null })}
            accessibilityLabel={d.appendTo ? t('capture.textToAdd') : d.intent === 'Note' ? t('review.noteText') : t('review.details')}
          />
          {d.clarification && <Text style={{ color: c.warn, fontSize: 14 }}>❓ {d.clarification}</Text>}
        </>
      )}
      {problems.length > 0 && <Text style={{ color: c.danger, fontSize: 13 }}>{problems.join(' ')}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
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
