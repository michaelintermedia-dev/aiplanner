import { dateKey, formatDue, todayKey } from '@shared/dates'
import type { Task } from '@shared/types'
import { router } from 'expo-router'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { tasksApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { useAction } from '@/lib/useAction'
import { useColors } from '@/theme'
import { Badge, Row } from './ui'

export function TaskRow({ task, last }: { task: Task; last?: boolean }) {
  const c = useColors()
  const { zone } = useAuth()
  const complete = useAction(tasksApi.complete)
  const reopen = useAction(tasksApi.reopen)
  const cancel = useAction(tasksApi.cancel)
  const remove = useAction(tasksApi.remove)

  const done = task.status === 'Completed' || task.status === 'Cancelled'
  const busy = complete.isPending || reopen.isPending || cancel.isPending || remove.isPending
  const overdue = !done && task.dueDateUtc !== null && dateKey(task.dueDateUtc, zone.timeZone) < todayKey(zone.timeZone)

  // Long press opens the less common actions, keeping the row itself clean.
  const showActions = () =>
    Alert.alert(task.title, undefined, [
      ...(!done ? [{ text: 'Cancel task', onPress: () => cancel.mutate(task.id) }] : []),
      { text: 'Delete', style: 'destructive' as const, onPress: () => remove.mutate(task.id) },
      { text: 'Close', style: 'cancel' as const },
    ])

  return (
    <Row last={last}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.status === 'Completed', disabled: busy || task.status === 'Cancelled' }}
        accessibilityLabel={task.status === 'Completed' ? 'Mark as not done' : 'Mark as done'}
        disabled={busy || task.status === 'Cancelled'}
        hitSlop={12}
        onPress={() => (done ? reopen.mutate(task.id) : complete.mutate(task.id))}
        style={[
          styles.check,
          { borderColor: task.status === 'Completed' ? c.task : c.border },
          task.status === 'Completed' && { backgroundColor: c.task },
        ]}>
        {task.status === 'Completed' && <Text style={[styles.tick, { color: c.surface }]}>✓</Text>}
      </Pressable>
      <Pressable
        style={styles.main}
        onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
        onLongPress={showActions}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityHint="Opens the task. Long-press for quick actions.">
        <Text style={[styles.title, { color: done ? c.muted : c.text }, done && styles.struck]}>{task.title}</Text>
        <View style={styles.meta}>
          {task.status === 'Cancelled' && <Badge label="Cancelled" />}
          {task.status === 'Ongoing' && <Badge label="Ongoing" color={c.accent} background={c.accentSoft} />}
          {task.dueDateUtc && (
            <Text style={[styles.metaText, { color: overdue ? c.danger : c.muted }]}>
              {formatDue(task.dueDateUtc, task.hasDueTime, zone)}
            </Text>
          )}
          {task.priority !== 'None' && (
            <Badge
              label={task.priority}
              color={task.priority === 'High' ? c.danger : task.priority === 'Medium' ? c.warn : c.muted}
            />
          )}
          {task.tags.map((tag) => (
            <Text key={tag} style={[styles.metaText, { color: c.muted }]}>
              #{tag}
            </Text>
          ))}
        </View>
      </Pressable>
    </Row>
  )
}

const styles = StyleSheet.create({
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tick: { fontSize: 14, fontWeight: '700', lineHeight: 16 },
  main: { flex: 1, gap: 3 },
  title: { fontSize: 16 },
  struck: { textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  metaText: { fontSize: 13 },
})
