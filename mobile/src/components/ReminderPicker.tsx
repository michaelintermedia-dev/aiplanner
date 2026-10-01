import Ionicons from '@expo/vector-icons/Ionicons'
import { dateKey, timeKey, zonedToUtc } from '@shared/dates'
import {
  BEFORE_CHOICES,
  describeReminder,
  minutesBeforeLabel,
  REMINDER_KINDS,
  reminderOfKind,
  reminderPresets,
  reminderProblem,
  repeats,
  WEEKDAYS,
} from '@shared/reminders'
import type { Reminder } from '@shared/types'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '@/auth/useAuth'
import { useColors } from '@/theme'
import { DateTimeField } from './DateTimeField'

/**
 * The one reminder control (same as web's ReminderPicker). Collapsed it reads
 * "Every day at 8:00 AM"; tapped it offers one-tap presets and a small editor
 * for once / before / every day / weekdays / weekly.
 */
export function ReminderPicker({
  value,
  onChange,
  itemHasTime,
  isNote = false,
  showProblem = true,
}: {
  value: Reminder | null
  onChange: (reminder: Reminder | null) => void
  /** The item has its own time, so "before it" makes sense. */
  itemHasTime: boolean
  isNote?: boolean
  /** Off where the caller already lists problems (the capture review). */
  showProblem?: boolean
}) {
  const c = useColors()
  const { zone } = useAuth()
  const [open, setOpen] = useState(false)
  const problem = reminderProblem(value, { itemHasTime, isNote })
  const kinds = REMINDER_KINDS.filter((k) => k.kind !== 'Before' || (!isNote && (itemHasTime || value?.kind === 'Before')))
  const chip = (active: boolean) => [styles.chip, { borderColor: active ? c.accent : c.border, backgroundColor: active ? c.accent : 'transparent' }]
  const chipText = (active: boolean) => ({ color: active ? '#fff' : c.text, fontSize: 14 })

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.row}>
        <Pressable
          onPress={() => setOpen((o) => !o)}
          style={[styles.summary, { borderColor: c.border }]}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={value ? `Reminder: ${describeReminder(value, zone)}. Tap to change.` : 'Add a reminder'}>
          <Ionicons name={repeats(value) ? 'repeat' : 'notifications-outline'} size={16} color={value ? c.text : c.muted} />
          <Text style={{ color: value ? c.text : c.muted, fontSize: 14 }}>{value ? describeReminder(value, zone) : 'Add a reminder'}</Text>
        </Pressable>
        {value && (
          <Pressable onPress={() => onChange(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Remove reminder">
            <Ionicons name="close" size={20} color={c.muted} />
          </Pressable>
        )}
      </View>

      {open && (
        <View style={[styles.editor, { borderColor: c.border, backgroundColor: c.surface2 }]}>
          <Text style={[styles.caption, { color: c.muted }]}>QUICK</Text>
          <View style={styles.wrap}>
            {reminderPresets(zone, itemHasTime && !isNote).map((p) => (
              <Pressable
                key={p.label}
                onPress={() => {
                  onChange(p.reminder)
                  setOpen(false)
                }}
                style={chip(false)}
                accessibilityRole="button">
                <Text style={chipText(false)}>{p.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.caption, { color: c.muted }]}>OR SET UP</Text>
          <View style={styles.wrap} accessibilityRole="radiogroup">
            {kinds.map((k) => (
              <Pressable
                key={k.kind}
                onPress={() => onChange(reminderOfKind(k.kind, value, zone))}
                style={chip(value?.kind === k.kind)}
                accessibilityRole="radio"
                accessibilityState={{ selected: value?.kind === k.kind }}>
                <Text style={chipText(value?.kind === k.kind)}>{k.label}</Text>
              </Pressable>
            ))}
          </View>

          {value?.kind === 'At' && (
            <View style={styles.wrap}>
              <DateTimeField
                mode="date"
                value={value.atUtc ? dateKey(value.atUtc, zone.timeZone) : null}
                onChange={(d) => d && onChange({ ...value, atUtc: zonedToUtc(d, value.atUtc ? timeKey(value.atUtc, zone.timeZone) : '09:00', zone.timeZone) })}
                placeholder="Date"
              />
              <DateTimeField
                mode="time"
                value={value.atUtc ? timeKey(value.atUtc, zone.timeZone) : null}
                date={value.atUtc ? dateKey(value.atUtc, zone.timeZone) : null}
                onChange={(t) => t && value.atUtc && onChange({ ...value, atUtc: zonedToUtc(dateKey(value.atUtc, zone.timeZone), t, zone.timeZone) })}
                placeholder="Time"
              />
            </View>
          )}

          {value?.kind === 'Before' && (
            <View style={styles.wrap}>
              {BEFORE_CHOICES.map((m) => (
                <Pressable key={m} onPress={() => onChange({ ...value, minutesBefore: m })} style={chip(value.minutesBefore === m)} accessibilityRole="radio">
                  <Text style={chipText(value.minutesBefore === m)}>{minutesBeforeLabel(m)}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {value?.kind === 'Weekly' && (
            <View style={styles.days}>
              {WEEKDAYS.map((day) => {
                const on = !!value.days?.includes(day)
                return (
                  <Pressable
                    key={day}
                    onPress={() => onChange({ ...value, days: on ? value.days!.filter((d) => d !== day) : [...(value.days ?? []), day] })}
                    style={[styles.day, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accent : 'transparent' }]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={day}>
                    <Text style={{ color: on ? '#fff' : c.text, fontSize: 13 }}>{day.slice(0, 2)}</Text>
                  </Pressable>
                )
              })}
            </View>
          )}

          {(value?.kind === 'Daily' || value?.kind === 'Weekdays' || value?.kind === 'Weekly') && (
            <View style={styles.wrap}>
              <DateTimeField mode="time" value={value.time ?? null} onChange={(t) => onChange({ ...value, time: t })} placeholder="Time" prefix="at" />
            </View>
          )}

          {repeats(value) && <Text style={{ color: c.muted, fontSize: 13 }}>Repeats until you turn it off.</Text>}
          <Pressable onPress={() => setOpen(false)} style={[styles.done, { borderColor: c.border }]} accessibilityRole="button">
            <Text style={{ color: c.text }}>Done</Text>
          </Pressable>
        </View>
      )}
      {showProblem && problem && <Text style={{ color: c.danger, fontSize: 13 }}>{problem}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 36 },
  caption: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  editor: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 34, justifyContent: 'center' },
  days: { flexDirection: 'row', gap: 4 },
  day: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  done: { alignSelf: 'flex-end', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
})
