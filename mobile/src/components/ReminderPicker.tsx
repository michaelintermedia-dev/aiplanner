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
  shortDay,
} from '@shared/reminders'
import type { Reminder } from '@shared/types'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '@/auth/useAuth'
import { useColors } from '@/theme'
import { DateTimeField } from './DateTimeField'
import { weekdaysInOrder } from '@shared/calendar'
import { t } from '@shared/i18n'
import { useFirstDayOfWeek } from '@/lib/weekStart'

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
  open: openProp,
  onOpenChange,
  emptyLabel = t('reminder.add'),
}: {
  value: Reminder | null
  onChange: (reminder: Reminder | null) => void
  /** The item has its own time, so "before it" makes sense. */
  itemHasTime: boolean
  isNote?: boolean
  /** Off where the caller already lists problems (the capture review). */
  showProblem?: boolean
  /** Controlled open state (ReminderList opens the reminder just added). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  emptyLabel?: string
}) {
  // Weeks are laid out from the chosen first day: re-render when it changes.
  useFirstDayOfWeek()
  const c = useColors()
  const { zone } = useAuth()
  const [ownOpen, setOwnOpen] = useState(false)
  const open = openProp ?? ownOpen
  const setOpen = (next: boolean) => (onOpenChange ? onOpenChange(next) : setOwnOpen(next))
  const problem = reminderProblem(value, { itemHasTime, isNote })
  const kinds = REMINDER_KINDS.filter((k) => k.kind !== 'Before' || (!isNote && (itemHasTime || value?.kind === 'Before')))
  const chip = (active: boolean) => [styles.chip, { borderColor: active ? c.accent : c.border, backgroundColor: active ? c.accent : 'transparent' }]
  const chipText = (active: boolean) => ({ color: active ? '#fff' : c.text, fontSize: 14 })

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.row}>
        <Pressable
          onPress={() => setOpen(!open)}
          style={[styles.summary, { borderColor: c.border }]}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={value ? t('reminder.aria', { reminder: describeReminder(value, zone) }) : emptyLabel}>
          <Ionicons name={repeats(value) ? 'repeat' : 'notifications-outline'} size={16} color={value ? c.text : c.muted} />
          <Text style={{ color: value ? c.text : c.muted, fontSize: 14 }}>{value ? describeReminder(value, zone) : emptyLabel}</Text>
        </Pressable>
        {value && (
          <Pressable onPress={() => onChange(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('reminder.remove')}>
            <Ionicons name="close" size={20} color={c.muted} />
          </Pressable>
        )}
      </View>

      {open && (
        <View style={[styles.editor, { borderColor: c.border, backgroundColor: c.surface2 }]}>
          <Text style={[styles.caption, { color: c.muted }]}>{t('reminder.quick').toUpperCase()}</Text>
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

          <Text style={[styles.caption, { color: c.muted }]}>{t('reminder.orSetUp').toUpperCase()}</Text>
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
                placeholder={t('item.date')}
              />
              <DateTimeField
                mode="time"
                value={value.atUtc ? timeKey(value.atUtc, zone.timeZone) : null}
                date={value.atUtc ? dateKey(value.atUtc, zone.timeZone) : null}
                onChange={(time) => time && value.atUtc && onChange({ ...value, atUtc: zonedToUtc(dateKey(value.atUtc, zone.timeZone), time, zone.timeZone) })}
                placeholder={t('item.time')}
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
              {weekdaysInOrder().map((day) => {
                const on = !!value.days?.includes(day)
                return (
                  <Pressable
                    key={day}
                    onPress={() => onChange({ ...value, days: on ? value.days!.filter((d) => d !== day) : [...(value.days ?? []), day] })}
                    style={[styles.day, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accent : 'transparent' }]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={shortDay(day, zone.locale)}>
                    <Text style={{ color: on ? '#fff' : c.text, fontSize: 13 }}>{shortDay(day, zone.locale)}</Text>
                  </Pressable>
                )
              })}
            </View>
          )}

          {(value?.kind === 'Daily' || value?.kind === 'Weekdays' || value?.kind === 'Weekly') && (
            <View style={styles.wrap}>
              <DateTimeField mode="time" value={value.time ?? null} onChange={(time) => onChange({ ...value, time })} placeholder={t('item.time')} prefix={t('reminder.at')} />
            </View>
          )}

          {repeats(value) && <Text style={{ color: c.muted, fontSize: 13 }}>{t('reminder.repeatsUntilOff')}</Text>}
          <Pressable onPress={() => setOpen(false)} style={[styles.done, { borderColor: c.border }]} accessibilityRole="button">
            <Text style={{ color: c.text }}>{t('common.done')}</Text>
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
