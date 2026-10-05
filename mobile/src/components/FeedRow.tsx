import { feedItemPassed, feedWhen, isDone, KIND_LABEL, feedReminder } from '@shared/feed'
import type { FeedItem } from '@shared/types'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { tasksApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { useAction } from '@/lib/useAction'
import { useColors, type Colors } from '@/theme'
import { KIND_ICON } from './kindIcons'
import { Badge } from './ui'
import { t } from '@shared/i18n'
import { priorityLabel, statusLabel } from '@shared/labels'

const kindColor = (item: FeedItem, c: Colors) =>
  item.kind === 'Appointment' ? c.appointment : item.kind === 'Note' ? c.warn : c.task

function openDetail(item: FeedItem) {
  if (item.kind === 'Task') router.push({ pathname: '/task/[id]', params: { id: item.id } })
  else if (item.kind === 'Appointment') router.push({ pathname: '/appointment/[id]', params: { id: item.id } })
  else router.push({ pathname: '/note/[id]', params: { id: item.id } })
}

/**
 * One feed entry, marked with its type's filter-tab icon. A task's icon is its
 * tick box (empty square / filled check); tapping the row opens the detail view.
 *
 * Long-press starts selecting (`onLongPress`). While selecting (`selection`
 * set) a tap picks the row instead.
 */
export function FeedRow({
  item,
  selection,
  onLongPress,
}: {
  item: FeedItem
  selection?: { selected: boolean; onToggle: () => void }
  onLongPress?: () => void
}) {
  const c = useColors()
  const { zone } = useAuth()
  const complete = useAction(tasksApi.complete)
  const reopen = useAction(tasksApi.reopen)
  const done = isDone(item)
  const passed = feedItemPassed(item)
  const when = feedWhen(item, zone)
  const reminder = feedReminder(item, zone)
  const showStatus = item.status && !['Scheduled', 'Planned', 'Inbox'].includes(item.status)

  const selected = selection?.selected ?? false

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: selected ? c.accentSoft : c.surface, borderColor: selected ? c.accent : c.border, borderLeftColor: kindColor(item, c) },
      ]}>
      {selection ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          accessibilityLabel={t('select.item', { title: item.title })}
          hitSlop={12}
          onPress={selection.onToggle}
          style={styles.iconBox}>
          <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={c.accent} />
        </Pressable>
      ) : item.kind === 'Task' ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.status === 'Completed' }}
          accessibilityLabel={item.status === 'Completed' ? t('task.markNotDone') : t('task.markDone')}
          disabled={complete.isPending || reopen.isPending || item.status === 'Cancelled'}
          hitSlop={12}
          onPress={() => (done ? reopen.mutate(item.id) : complete.mutate(item.id))}
          style={styles.iconBox}>
          <Ionicons name={item.status === 'Completed' ? 'checkbox' : 'square-outline'} size={24} color={c.task} />
        </Pressable>
      ) : (
        <View style={styles.iconBox}>
          <Ionicons name={KIND_ICON[item.kind]} size={24} color={kindColor(item, c)} />
        </View>
      )}
      <Pressable
        style={styles.main}
        onPress={() => (selection ? selection.onToggle() : openDetail(item))}
        onLongPress={selection ? undefined : onLongPress}
        accessibilityRole="button"
        accessibilityHint={selection ? (selected ? t('select.hintUnselect') : t('select.hintSelect')) : t('feed.rowHint')}>
        <Text style={[styles.title, { color: done || passed ? c.muted : c.text }, (done || passed) && styles.struck]} numberOfLines={2}>
          {item.title}
        </Text>
        {item.snippet && (
          <Text style={{ color: c.muted, fontSize: 14 }} numberOfLines={2}>
            {item.snippet}
          </Text>
        )}
        <View style={styles.meta}>
          <Text style={[styles.kind, { color: c.muted }]}>{KIND_LABEL[item.kind].toUpperCase()}</Text>
          {when && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              {item.repeats && <Ionicons name="repeat" size={14} color={c.muted} accessibilityLabel={t('repeat.repeats')} />}
              <Text style={[styles.metaText, { color: c.muted }]}>{when}</Text>
            </View>
          )}
          {reminder && (
            <View style={styles.reminder} accessible accessibilityLabel={t('feed.reminderAt', { when: reminder.label })}>
              <Ionicons name="notifications-outline" size={14} color={reminder.today ? c.accent : c.muted} />
              <Text style={[styles.metaText, { color: reminder.today ? c.accent : c.muted, fontWeight: reminder.today ? '600' : '400' }]}>
                {reminder.label}
              </Text>
            </View>
          )}
          {item.location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name="location-outline" size={13} color={c.muted} />
              <Text style={[styles.metaText, { color: c.muted }]}>{item.location}</Text>
            </View>
          )}
          {passed && <Badge label={t('status.passed')} />}
          {showStatus && <Badge label={statusLabel(item.status!)} color={item.status === 'Completed' ? c.task : item.status === 'Cancelled' ? c.danger : undefined} />}
          {item.priority && <Badge label={priorityLabel(item.priority)} color={item.priority === 'High' ? c.danger : item.priority === 'Medium' ? c.warn : undefined} />}
          {item.tags.map((t) => (
            <Text key={t} style={[styles.metaText, { color: c.muted }]}>#{t}</Text>
          ))}
          {item.fromCapture && <Ionicons name="mic-outline" size={14} color={c.muted} accessibilityLabel={t('feed.fromCapture')} />}
        </View>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderRadius: 12,
  },
  iconBox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, gap: 3 },
  title: { fontSize: 16 },
  struck: { textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 2 },
  kind: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  metaText: { fontSize: 13 },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: 3 },
})
