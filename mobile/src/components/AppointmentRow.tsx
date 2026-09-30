import { formatTime } from '@shared/dates'
import type { Appointment } from '@shared/types'
import { router } from 'expo-router'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { appointmentsApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { useAction } from '@/lib/useAction'
import { useColors } from '@/theme'
import { Badge, Row } from './ui'

export function AppointmentRow({ appointment: a, last }: { appointment: Appointment; last?: boolean }) {
  const c = useColors()
  const { zone } = useAuth()
  const complete = useAction(appointmentsApi.complete)
  const cancel = useAction(appointmentsApi.cancel)
  const done = a.status !== 'Scheduled'

  const showActions = () =>
    Alert.alert(a.title, undefined, [
      { text: 'Mark as done', onPress: () => complete.mutate(a.id) },
      { text: 'Cancel appointment', style: 'destructive', onPress: () => cancel.mutate(a.id) },
      { text: 'Close', style: 'cancel' },
    ])

  return (
    <Row last={last}>
      <View style={[styles.time, { borderColor: c.appointment }]}>
        <Text style={[styles.start, { color: c.text }]}>{formatTime(a.startUtc, zone)}</Text>
        <Text style={[styles.end, { color: c.muted }]}>{formatTime(a.endUtc, zone)}</Text>
      </View>
      <Pressable
        style={styles.main}
        onPress={() => router.push({ pathname: '/appointment/[id]', params: { id: a.id } })}
        onLongPress={done ? undefined : showActions}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityHint="Opens the appointment. Long-press for quick actions.">
        <Text style={[styles.title, { color: done ? c.muted : c.text }, done && styles.struck]}>{a.title}</Text>
        <View style={styles.meta}>
          {a.location && <Text style={[styles.metaText, { color: c.muted }]}>{a.location}</Text>}
          {done && <Badge label={a.status} />}
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
