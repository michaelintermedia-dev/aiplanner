import Ionicons from '@expo/vector-icons/Ionicons'
import { describeRecurrence, presetLabel, presetOf, presetRule, REPEAT_PRESETS, weekdayOf, type RepeatPreset } from '@shared/recurrence'
import { shortDay } from '@shared/reminders'
import { weekdaysInOrder } from '@shared/calendar'
import { t } from '@shared/i18n'
import type { Recurrence } from '@shared/types'
import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '@/auth/useAuth'
import { useColors } from '@/theme'
import { DateTimeField } from './DateTimeField'
import { useFirstDayOfWeek } from '@/lib/weekStart'

/**
 * How a task or event repeats: quick choices that use the item's own date
 * ("Every Monday", "Every month on day 5"), or Custom - every N
 * days/weeks/months, which days, and when it ends. Same as the web's.
 */
export function RecurrencePicker({
  value,
  onChange,
  date,
  disabled,
}: {
  value: Recurrence | null
  onChange: (value: Recurrence | null) => void
  /** The item's date ("yyyy-MM-dd") - the first occurrence; fills in the day. */
  date: string | null
  disabled?: boolean
}) {
  // Weeks are laid out from the chosen first day: re-render when it changes.
  useFirstDayOfWeek()
  const c = useColors()
  const { zone } = useAuth()
  const preset = presetOf(value, date)
  const [custom, setCustom] = useState(preset === null)
  const editing = custom || preset === null

  const choose = (p: RepeatPreset | 'Custom') => {
    if (p === 'Custom') {
      setCustom(true)
      // "Every weekday" spelled out (weekly on Mon-Fri), so the editor shows what it is.
      onChange(
        value?.frequency === 'Weekdays'
          ? { frequency: 'Weekly', interval: 1, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] }
          : (value ?? { frequency: 'Weekly', interval: 1, days: date ? [weekdayOf(date)] : null }),
      )
      return
    }
    setCustom(false)
    onChange(presetRule(p, date))
  }

  return (
    <View style={[styles.box, disabled && { opacity: 0.5 }]} pointerEvents={disabled ? 'none' : 'auto'}>
      <View style={styles.head}>
        <Ionicons name="repeat" size={16} color={c.muted} />
        <Text style={{ color: c.muted, fontSize: 13 }}>{t('repeat.label')}</Text>
        {value && <Text style={{ color: c.text, fontSize: 13, flex: 1 }}>· {describeRecurrence(value, zone)}</Text>}
      </View>
      <View style={styles.chips}>
        {REPEAT_PRESETS.map((p) => (
          <Chip key={p} selected={!editing && preset === p} onPress={() => choose(p)}>
            {presetLabel(p, date, zone)}
          </Chip>
        ))}
        <Chip selected={editing} onPress={() => choose('Custom')}>
          {t('repeat.custom')}
        </Chip>
      </View>
      {editing && value && <CustomRule value={value} onChange={onChange} />}
    </View>
  )
}

function CustomRule({ value, onChange }: { value: Recurrence; onChange: (value: Recurrence) => void }) {
  const c = useColors()
  const { zone } = useAuth()
  const set = (patch: Partial<Recurrence>) => onChange({ ...value, ...patch })
  const n = Math.max(1, value.interval || 1)
  const ends = value.until ? 'date' : value.count ? 'count' : 'never'

  return (
    <View style={[styles.custom, { borderColor: c.border }]}>
      <View style={styles.row}>
        <Text style={{ color: c.muted }}>{t('repeat.every')}</Text>
        <Stepper value={n} min={1} max={99} onChange={(interval) => set({ interval })} />
        {(['Daily', 'Weekly', 'Monthly'] as const).map((f) => (
          <Chip key={f} selected={(value.frequency === 'Weekdays' ? 'Daily' : value.frequency) === f} onPress={() => set({ frequency: f })}>
            {t(f === 'Daily' ? 'repeat.unitDay' : f === 'Weekly' ? 'repeat.unitWeek' : 'repeat.unitMonth', { count: n })}
          </Chip>
        ))}
      </View>
      {value.frequency === 'Weekly' && (
        <View style={styles.chips} accessibilityLabel={t('repeat.onDays')}>
          {weekdaysInOrder().map((d) => {
            const on = value.days?.includes(d) ?? false
            return (
              <Chip key={d} selected={on} onPress={() => set({ days: on ? (value.days ?? []).filter((x) => x !== d) : [...(value.days ?? []), d] })}>
                {shortDay(d, zone.locale)}
              </Chip>
            )
          })}
        </View>
      )}
      {value.frequency === 'Monthly' && (
        <View style={styles.row}>
          <Text style={{ color: c.muted }}>{t('repeat.onMonthDay')}</Text>
          <Stepper value={value.monthDay ?? 1} min={1} max={31} onChange={(monthDay) => set({ monthDay })} />
        </View>
      )}
      <View style={styles.row}>
        <Text style={{ color: c.muted }}>{t('repeat.ends')}</Text>
        <Chip selected={ends === 'never'} onPress={() => set({ until: null, count: null })}>
          {t('repeat.never')}
        </Chip>
        <Chip selected={ends === 'date'} onPress={() => set({ until: value.until ?? new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10), count: null })}>
          {t('repeat.onDate')}
        </Chip>
        <Chip selected={ends === 'count'} onPress={() => set({ count: value.count ?? 10, until: null })}>
          {t('repeat.after')}
        </Chip>
      </View>
      {ends === 'date' && <DateTimeField mode="date" value={value.until ?? null} onChange={(until) => set({ until })} placeholder={t('repeat.onDate')} />}
      {ends === 'count' && (
        <View style={styles.row}>
          <Stepper value={value.count ?? 10} min={1} max={999} onChange={(count) => set({ count })} />
          <Text style={{ color: c.muted }}>{t('repeat.timesUnit')}</Text>
        </View>
      )}
    </View>
  )
}

function Chip({ selected, onPress, children }: { selected: boolean; onPress: () => void; children: ReactNode }) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? c.accent : c.border, backgroundColor: selected ? c.accent : c.surface }]}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <Text style={{ color: selected ? '#fff' : c.text, fontSize: 13 }}>{children}</Text>
    </Pressable>
  )
}

/** − n + (a small number picker). */
function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  const c = useColors()
  const step = (d: number) => onChange(Math.min(max, Math.max(min, value + d)))
  return (
    <View style={[styles.stepper, { borderColor: c.border }]}>
      <Pressable onPress={() => step(-1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="−">
        <Ionicons name="remove" size={18} color={c.text} />
      </Pressable>
      <Text style={{ color: c.text, minWidth: 28, textAlign: 'center' }}>{value}</Text>
      <Pressable onPress={() => step(1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="+">
        <Ionicons name="add" size={18} color={c.text} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  custom: { gap: 10, borderWidth: 1, borderRadius: 12, padding: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
})
