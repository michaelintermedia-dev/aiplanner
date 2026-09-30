import { draftProblems, toConfirmItem, toDraft, type ItemDraft } from '@shared/captureDraft'
import type { Capture, ExtractionIntent, TaskPriority } from '@shared/types'
import { useState } from 'react'
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { capturesApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { useAction } from '@/lib/useAction'
import { useColors, type Colors } from '@/theme'
import { DateTimeField } from './DateTimeField'
import { Button } from './ui'

const INTENTS: ExtractionIntent[] = ['Task', 'Appointment', 'Reminder', 'Note']
const PRIORITIES: (TaskPriority | null)[] = [null, 'Low', 'Medium', 'High']
const REMINDERS: (number | null)[] = [null, 0, 10, 30, 60, 1440]

const reminderLabel = (m: number | null) =>
  m === null ? 'No reminder' : m === 0 ? 'Remind at the time' : m >= 1440 ? `${m / 1440} day before` : m >= 60 ? `${m / 60} h before` : `${m} min before`

const intentColor = (intent: ExtractionIntent, c: Colors) =>
  intent === 'Appointment' ? c.appointment : intent === 'Reminder' ? c.warn : intent === 'Note' ? c.muted : c.task

/**
 * "I understood:" (spec section 18). Every property is editable; only switched-on
 * items are saved, and only when the user presses Save.
 */
export function CaptureReview({ capture, onDone }: { capture: Capture; onDone: (message: string | null) => void }) {
  const c = useColors()
  const { zone } = useAuth()
  const confirm = useAction((items: ReturnType<typeof toConfirmItem>[]) => capturesApi.confirm(capture.id, items))
  const [drafts, setDrafts] = useState<ItemDraft[]>(() =>
    capture.items.filter((i) => i.status === 'PendingReview').map((i) => toDraft(i, zone.timeZone)),
  )
  const [showTranscript, setShowTranscript] = useState(false)

  const update = (id: string, patch: Partial<ItemDraft>) =>
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)))

  const included = drafts.filter((d) => d.include)
  const blocked = drafts.some((d) => draftProblems(d).length > 0)

  const save = () =>
    confirm.mutate(
      drafts.map((d) => toConfirmItem(d, zone.timeZone)),
      { onSuccess: () => onDone(included.length ? `Saved ${included.length} item${included.length > 1 ? 's' : ''}.` : null) },
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
      <Text style={{ color: c.muted }}>I understood:</Text>
      <Text style={[styles.title, { color: c.text }]}>{capture.title}</Text>
      {capture.summary && <Text style={{ color: c.text }}>{capture.summary}</Text>}
      <Pressable onPress={() => setShowTranscript((s) => !s)} accessibilityRole="button">
        <Text style={{ color: c.muted }}>
          {showTranscript ? '▾' : '▸'} {capture.source === 'Voice' ? 'Full transcription' : 'What you typed'}
        </Text>
      </Pressable>
      {showTranscript && (
        <Text style={[styles.transcript, { color: c.text, backgroundColor: c.surface2 }]}>{capture.inputText}</Text>
      )}

      {drafts.length === 0 ? (
        <Text style={{ color: c.muted }}>I didn’t find anything to plan in that.</Text>
      ) : (
        drafts.map((d) => <ItemEditor key={d.id} draft={d} onChange={(patch) => update(d.id, patch)} />)
      )}

      {confirm.error && <Text style={{ color: c.danger }}>{confirm.error.message}</Text>}
      <View style={styles.actions}>
        <Button title="Cancel" onPress={discard} disabled={confirm.isPending} />
        <Button
          title={included.length === drafts.length ? 'Save all' : `Save ${included.length}`}
          variant="primary"
          onPress={save}
          busy={confirm.isPending}
          disabled={blocked || drafts.length === 0}
        />
      </View>
    </View>
  )
}

function ItemEditor({ draft: d, onChange }: { draft: ItemDraft; onChange: (patch: Partial<ItemDraft>) => void }) {
  const c = useColors()
  const problems = draftProblems(d)
  const dated = d.intent !== 'Note'
  const cycle = <T,>(list: T[], value: T) => list[(list.indexOf(value) + 1) % list.length]

  return (
    <View style={[styles.item, { borderColor: c.border, borderLeftColor: intentColor(d.intent, c), opacity: d.include ? 1 : 0.55 }]}>
      <View style={styles.row}>
        <Switch
          value={d.include}
          onValueChange={(include) => onChange({ include })}
          accessibilityLabel={d.include ? 'Included' : 'Excluded'}
          trackColor={{ true: c.accent }}
        />
        <TextInput
          style={[styles.itemTitle, { color: c.text, borderColor: c.border }, !d.include && styles.struck]}
          value={d.title}
          onChangeText={(title) => onChange({ title })}
          accessibilityLabel="Title"
        />
      </View>

      {d.include && (
        <>
          <View style={styles.chips}>
            {INTENTS.map((intent) => (
              <Pressable
                key={intent}
                onPress={() => onChange({ intent })}
                style={[
                  styles.chip,
                  { borderColor: d.intent === intent ? intentColor(intent, c) : c.border },
                  d.intent === intent && { backgroundColor: c.surface2 },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: d.intent === intent }}>
                <Text style={{ color: d.intent === intent ? c.text : c.muted, fontSize: 13 }}>{intent}</Text>
              </Pressable>
            ))}
          </View>

          {dated && (
            <View style={styles.chips}>
              <DateTimeField mode="date" value={d.date} onChange={(date) => onChange({ date })} placeholder="Date" />
              <DateTimeField
                mode="time"
                value={d.time}
                onChange={(time) => onChange({ time })}
                placeholder={d.intent === 'Appointment' ? 'Start' : 'Time'}
                date={d.date}
              />
              {d.intent === 'Appointment' && (
                <DateTimeField mode="time" value={d.endTime} onChange={(endTime) => onChange({ endTime })} placeholder="End" date={d.date} prefix="until" />
              )}
            </View>
          )}

          {d.intent === 'Appointment' && (
            <TextInput
              style={[styles.field, { color: c.text, borderColor: c.border }]}
              placeholder="Location"
              placeholderTextColor={c.muted}
              value={d.location ?? ''}
              onChangeText={(location) => onChange({ location: location || null })}
            />
          )}

          {dated && (
            <View style={styles.chips}>
              {(d.intent === 'Task' || d.intent === 'Reminder') && (
                <Pressable
                  onPress={() => onChange({ priority: cycle(PRIORITIES, d.priority) })}
                  style={[styles.chip, { borderColor: c.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Priority: ${d.priority ?? 'none'}. Tap to change.`}>
                  <Text style={{ color: d.priority === 'High' ? c.danger : d.priority ? c.text : c.muted }}>
                    {d.priority ? `${d.priority} priority` : 'No priority'}
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() =>
                  onChange({
                    reminderMinutesBefore: cycle(REMINDERS, REMINDERS.includes(d.reminderMinutesBefore) ? d.reminderMinutesBefore : null),
                  })
                }
                style={[styles.chip, { borderColor: c.border }]}
                accessibilityRole="button"
                accessibilityLabel={`${reminderLabel(d.reminderMinutesBefore)}. Tap to change.`}>
                <Text style={{ color: d.reminderMinutesBefore === null ? c.muted : c.text }}>
                  🔔 {reminderLabel(d.reminderMinutesBefore)}
                </Text>
              </Pressable>
            </View>
          )}

          {d.description && <Text style={{ color: c.muted, fontSize: 13 }}>{d.description}</Text>}
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
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
})
