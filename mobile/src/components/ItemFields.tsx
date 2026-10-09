import Ionicons from '@expo/vector-icons/Ionicons'
import { endsNextDay } from '@shared/dates'
import { KIND_LABEL } from '@shared/feed'
import { t } from '@shared/i18n'
import { formHasTime, type FormField, type ItemForm } from '@shared/itemForm'
import { priorityLabel } from '@shared/labels'
import type { ItemType, TaskPriority } from '@shared/types'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useColors } from '@/theme'
import { DateTimeField } from './DateTimeField'
import { CycleChip, detailStyles as s, Field } from './detail'
import { KIND_ICON } from './kindIcons'
import { RecurrencePicker } from './RecurrencePicker'
import { ReminderList } from './ReminderList'
import { TagPicker } from './TagPicker'

const TYPES: ItemType[] = ['Task', 'Appointment', 'Note']
const PRIORITIES: TaskPriority[] = ['None', 'Low', 'Medium', 'High']

/**
 * An item's fields, as the Edit screen shows them - shared by the Edit screen
 * and the review of a new entry (user's call, 2026-10-09: the review IS the
 * Edit form), so the two never drift apart. `changed`: fields the AI just filled in.
 * Same as the web's ItemFields.
 */
export function ItemFields({
  form,
  set,
  setType,
  changed,
  afterType,
}: {
  form: ItemForm
  set: (patch: Partial<ItemForm>) => void
  /** The Type chips (switchType keeps what was typed). */
  setType: (type: ItemType) => void
  changed: FormField[]
  /** Shown right under the Type chips (the Edit screen's "Changes it from Task to Event"). */
  afterType?: ReactNode
}) {
  const c = useColors()
  const isNote = form.type === 'Note'
  const marked = (key: FormField) => changed.includes(key)
  const ring = (key: FormField) => (marked(key) ? { borderWidth: 2, borderColor: c.accent, borderRadius: 12, padding: 4 } : null)
  return (
    <>
        <View style={[styles.chips, ring('type')]} accessibilityRole="radiogroup" accessibilityLabel={t('changeType.label')}>
          {TYPES.map((type) => {
            const selected = form.type === type
            return (
              <Pressable
                key={type}
                onPress={() => setType(type)}
                style={[styles.chip, { borderColor: selected ? c.accent : c.border, backgroundColor: selected ? c.surface2 : c.surface }]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}>
                <Ionicons name={KIND_ICON[type]} size={16} color={selected ? c.text : c.muted} />
                <Text style={{ color: selected ? c.text : c.muted }}>{KIND_LABEL[type]}</Text>
              </Pressable>
            )
          })}
        </View>
        {afterType}

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

        {/* Every type has the same attributes (user's call, 2026-10-09): priority, place, people. */}
        <View style={[s.chips, ring('priority')]}>
          <CycleChip
            values={PRIORITIES}
            value={form.priority}
            onChange={(priority) => set({ priority })}
            label={(p) => (p === 'None' ? t('task.noPriority') : t('task.priorityBadge', { priority: priorityLabel(p) }))}
            highlight={(p) => p !== 'None'}
          />
          {form.type === 'Task' && (
            <CycleChip
              values={[false, true]}
              value={form.ongoing}
              onChange={(ongoing) => set({ ongoing })}
              label={(o) => (o ? `${t('today.ongoing')} ✓` : t('today.ongoing'))}
              highlight={(o) => o}
            />
          )}
        </View>
        <Field label={t('event.location')} value={form.location} onChangeText={(location) => set({ location })} changed={marked('location')} />
        <Field
          label={`${t('event.with')} ${t('item.commaSeparated')}`}
          value={form.people}
          onChangeText={(people) => set({ people })}
          changed={marked('people')}
        />

        {form.type !== 'Note' && (
          <View style={ring('recurrence')}>
            <RecurrencePicker
              value={form.recurrence}
              onChange={(recurrence) => set({ recurrence })}
              date={form.date || null}
              disabled={form.type === 'Task' && form.ongoing}
            />
          </View>
        )}
        <View style={ring('reminders')}>
          <ReminderList value={form.reminders} onChange={(reminders) => set({ reminders })} itemHasTime={formHasTime(form)} isNote={isNote} />
        </View>
        <TagPicker value={form.tags} onChange={(tags) => set({ tags })} changed={marked('tags')} />
        <Field
          label={isNote ? t('kind.note') : t('item.description')}
          value={form.details}
          onChangeText={(details) => set({ details })}
          multiline
          changed={marked('details')}
        />
    </>
  )
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
})
