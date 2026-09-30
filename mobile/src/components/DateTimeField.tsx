import { dateKey, formatDateKey, formatTime, timeKey, todayKey, zonedToUtc } from '@shared/dates'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '@/auth/useAuth'
import { useColors } from '@/theme'

/**
 * A tappable chip that picks a date ("yyyy-MM-dd") or time ("HH:mm") as a
 * wall-clock value in the user's profile timezone. Android opens the native
 * dialog; iOS shows the picker inline under the chip.
 */
export function DateTimeField({
  mode,
  value,
  onChange,
  placeholder,
  disabled,
  date,
}: {
  mode: 'date' | 'time'
  value: string | null
  onChange: (value: string | null) => void
  placeholder: string
  disabled?: boolean
  /** For time pickers: the day the time belongs to (defaults to today). */
  date?: string | null
}) {
  const c = useColors()
  const { zone } = useAuth()
  const [iosOpen, setIosOpen] = useState(false)

  const day = mode === 'date' ? (value ?? todayKey(zone.timeZone)) : (date ?? todayKey(zone.timeZone))
  const current = new Date(zonedToUtc(day, mode === 'time' ? (value ?? '09:00') : '12:00', zone.timeZone))
  const pick = (picked: Date) => onChange(mode === 'date' ? dateKey(picked, zone.timeZone) : timeKey(picked, zone.timeZone))

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode,
        is24Hour: true,
        timeZoneName: zone.timeZone,
        onValueChange: (_, picked) => pick(picked),
      })
    } else {
      setIosOpen((o) => !o)
    }
  }

  const label = !value
    ? placeholder
    : mode === 'date'
      ? formatDateKey(value, zone.locale, { weekday: 'short', month: 'short', day: 'numeric' })
      : formatTime(zonedToUtc(day, value, zone.timeZone), zone)
  return (
    <View>
      <View style={[styles.chip, { borderColor: c.border, backgroundColor: c.surface, opacity: disabled ? 0.5 : 1 }]}>
        <Pressable onPress={open} disabled={disabled} accessibilityRole="button" accessibilityLabel={placeholder}>
          <Text style={[styles.text, { color: value ? c.text : c.muted }]}>{label}</Text>
        </Pressable>
        {value && !disabled && (
          <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityLabel={`Clear ${placeholder.toLowerCase()}`}>
            <Text style={[styles.clear, { color: c.muted }]}>×</Text>
          </Pressable>
        )}
      </View>
      {Platform.OS === 'ios' && iosOpen && (
        <DateTimePicker
          value={current}
          mode={mode}
          display={mode === 'date' ? 'inline' : 'spinner'}
          timeZoneName={zone.timeZone}
          onValueChange={(_, picked) => pick(picked)}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 40,
  },
  text: { fontSize: 15, fontVariant: ['tabular-nums'] },
  clear: { fontSize: 18, lineHeight: 20 },
})
