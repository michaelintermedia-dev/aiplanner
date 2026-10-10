import { useNow } from '@/lib/useNow'
import { dateKey, formatDateKey, formatTime } from '@shared/dates'
import { t } from '@shared/i18n'
import { occurrences } from '@shared/recurrence'
import type { Appointment } from '@shared/types'
import { useLocalSearchParams } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { appointmentsApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { useAction } from '@/lib/useAction'
import { useColors } from '@/theme'
import { useInPanel } from './panel'
import { Button } from './ui'

/**
 * A repeating event's next dates, each with Skip ("not this week"), and the
 * skipped ones still ahead with Bring back. Opened from a calendar entry
 * (`at` param), that date is marked. Same as the web's.
 */
export function EventDates({ appt }: { appt: Appointment }) {
  const c = useColors()
  const inPanel = useInPanel()
  const { zone } = useAuth()
  const { at } = useLocalSearchParams<{ at?: string }>()
  const skip = useAction((start: string) => appointmentsApi.skip(appt.id, start))
  const unskip = useAction((start: string) => appointmentsApi.unskip(appt.id, start))
  const now = useNow().getTime()
  if (!appt.recurrence) return null

  const length = Date.parse(appt.endUtc) - Date.parse(appt.startUtc)
  const fromUtc = new Date(now - length).toISOString()
  const skipped = (appt.skippedUtc ?? []).filter((s) => Date.parse(s) + length > now)
  const next = occurrences(appt.recurrence, appt.startUtc, zone.timeZone, { fromUtc, max: 4, skipped: appt.skippedUtc ?? [] })
  const when = (start: string) =>
    `${formatDateKey(dateKey(start, zone.timeZone), zone.locale, { weekday: 'short', month: 'short', day: 'numeric' })}, ${formatTime(start, zone)}`
  const busy = skip.isPending || unskip.isPending

  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.heading, { color: c.muted }]}>{t('repeat.nextDates').toUpperCase()}</Text>
      {next.map((start) => (
        <View
          key={start}
          style={[styles.row, { backgroundColor: inPanel ? 'transparent' : c.surface, borderColor: at && Date.parse(at) === Date.parse(start) ? c.accent : c.border }]}>
          <Text style={{ color: c.text, flex: 1 }}>{when(start)}</Text>
          <Button title={t('repeat.skip')} variant="link" disabled={busy} onPress={() => skip.mutate(start)} />
        </View>
      ))}
      {skipped.map((start) => (
        <View key={`s${start}`} style={[styles.row, { backgroundColor: inPanel ? 'transparent' : c.surface, borderColor: c.border }]}>
          <Text style={{ color: c.muted, flex: 1 }}>
            <Text style={{ textDecorationLine: 'line-through' }}>{when(start)}</Text> · {t('repeat.skipped')}
          </Text>
          <Button title={t('repeat.bringBack')} variant="link" disabled={busy} onPress={() => unskip.mutate(start)} />
        </View>
      ))}
      {(skip.error ?? unskip.error) && <Text style={{ color: c.danger }}>{(skip.error ?? unskip.error)!.message}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  heading: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
})
