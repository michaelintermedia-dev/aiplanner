import Ionicons from '@expo/vector-icons/Ionicons'
import { formatTime } from '@shared/dates'
import { eventPassed } from '@shared/feed'
import type { Appointment } from '@shared/types'
import { router } from 'expo-router'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { appointmentsApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { useAction } from '@/lib/useAction'
import { useColors } from '@/theme'
import { Badge, Row } from './ui'
import { t } from '@shared/i18n'
import { statusLabel } from '@shared/labels'

export function AppointmentRow({ appointment: a, last }: { appointment: Appointment; last?: boolean }) {
  const c = useColors()
  const { zone } = useAuth()
  const complete = useAction(appointmentsApi.complete)
  const cancel = useAction(appointmentsApi.cancel)
  const done = a.status !== 'Scheduled'
  const passed = eventPassed(a)

  const skip = useAction((start: string) => appointmentsApi.skip(a.id, start))
  const repeats = !!(a.recurrence || a.isOccurrence)
  const showActions = () =>
    Alert.alert(a.title, undefined, [
      // A repeating event: this date is skipped, the series goes on.
      repeats ? { text: t('repeat.skip'), onPress: () => skip.mutate(a.startUtc) } : { text: t('task.markDone'), onPress: () => complete.mutate(a.id) },
      { text: t('event.cancel'), style: 'destructive', onPress: () => cancel.mutate(a.id) },
      { text: t('common.close'), style: 'cancel' },
    ])

  return (
    <Row last={last}>
      <View style={[styles.time, { borderColor: c.appointment }]}>
        <Text style={[styles.start, { color: c.text }]}>{formatTime(a.startUtc, zone)}</Text>
        <Text style={[styles.end, { color: c.muted }]}>{formatTime(a.endUtc, zone)}</Text>
      </View>
      <Pressable
        style={styles.main}
        onPress={() => router.push({ pathname: '/appointment/[id]', params: a.isOccurrence ? { id: a.id, at: a.startUtc } : { id: a.id } })}
        onLongPress={done ? undefined : showActions}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityHint={t('event.rowHint')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.title, { color: done || passed ? c.muted : c.text }, (done || passed) && styles.struck]}>{a.title}</Text>
          {repeats && <Ionicons name="repeat" size={14} color={c.muted} accessibilityLabel={t('repeat.repeats')} />}
        </View>
        <View style={styles.meta}>
          {a.location && <Text style={[styles.metaText, { color: c.muted }]}>{a.location}</Text>}
          {done && <Badge label={statusLabel(a.status)} />}
          {passed && <Badge label={t('status.passed')} />}
        </View>
      </Pressable>
    </Row>
  )
}

const styles = StyleSheet.create({
  time: { borderLeftWidth: 3, paddingLeft: 8, minWidth: 64 },
  start: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  end: { fontSize: 13, fontVariant: ['tabular-nums'] },
  main: { flex: 1, gap: 3 },
  title: { fontSize: 16 },
  struck: { textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  metaText: { fontSize: 13 },
})
