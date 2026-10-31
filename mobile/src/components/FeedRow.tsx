import { eventTime, feedItemPassed, isDone, rowIndicator } from '@shared/feed'
import { highlight } from '@shared/highlight'
import { t } from '@shared/i18n'
import type { FeedItem } from '@shared/types'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { tasksApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { useAction } from '@/lib/useAction'
import { useColors, type Colors } from '@/theme'
import { KIND_ICON } from './kindIcons'

function openDetail(item: FeedItem) {
  if (item.kind === 'Task') router.push({ pathname: '/task/[id]', params: { id: item.id } })
  else if (item.kind === 'Appointment') router.push({ pathname: '/appointment/[id]', params: { id: item.id } })
  else router.push({ pathname: '/note/[id]', params: { id: item.id } })
}

/**
 * One feed entry, for triage (spec v2, same as the web): its control (a task's
 * tick box, an event's start time, a note's icon), the title and ONE
 * indicator - the next reminder, else the date when it isn't today, else the
 * repeat icon, else a note's first line (rowIndicator). High priority is the
 * bar on its edge. Place, people, tags and the rest are on the item's screen.
 *
 * Long-press starts selecting (`onLongPress`). While selecting (`selection`
 * set) a tap picks the row instead.
 */
export function FeedRow({
  item,
  selection,
  onLongPress,
  words = [],
}: {
  item: FeedItem
  selection?: { selected: boolean; onToggle: () => void }
  onLongPress?: () => void
  /** Search words to mark in the title. */
  words?: string[]
}) {
  const c = useColors()
  const { zone } = useAuth()
  const complete = useAction(tasksApi.complete)
  const reopen = useAction(tasksApi.reopen)
  const done = isDone(item)
  const passed = feedItemPassed(item)
  const indicator = rowIndicator(item, zone)
  const time = eventTime(item, zone)
  const selected = selection?.selected ?? false
  const high = item.priority === 'High'

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: selected ? c.accentSoft : c.surface, borderColor: selected ? c.accent : c.border, borderLeftColor: high ? c.danger : 'transparent' },
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
      ) : time ? (
        <View style={[styles.time, { backgroundColor: passed ? 'transparent' : c.accentSoft }]}>
          <Text style={[styles.timeText, { color: passed ? c.muted : c.appointment }]}>{time}</Text>
        </View>
      ) : (
        <View style={styles.iconBox}>
          <Ionicons name={KIND_ICON[item.kind]} size={24} color={c.warn} />
        </View>
      )}
      <Pressable
        style={styles.main}
        onPress={() => (selection ? selection.onToggle() : openDetail(item))}
        // Never undefined: the long press that starts selecting re-renders this row in select mode, and a
        // Pressable whose onLongPress is gone treats the finger lifting as a tap - which unselected it again.
        onLongPress={selection ? selection.onToggle : onLongPress}
        accessibilityRole="button"
        accessibilityHint={selection ? (selected ? t('select.hintUnselect') : t('select.hintSelect')) : t('feed.rowHint')}>
        <View style={styles.line}>
          <Text style={[styles.title, { color: done || passed ? c.muted : c.text }, (done || passed) && styles.struck]} numberOfLines={2}>
            <Marked text={item.title} words={words} c={c} />
          </Text>
          {indicator && indicator.type !== 'text' && (
            <View style={styles.indicator}>
              {indicator.type === 'reminder' ? (
                <View style={styles.indicator} accessible accessibilityLabel={t('feed.reminderAt', { when: indicator.label })}>
                  <Ionicons name={indicator.repeats ? 'repeat' : 'notifications-outline'} size={14} color={indicator.today ? c.accent : c.muted} />
                  <Text style={[styles.meta, { color: indicator.today ? c.accent : c.muted, fontWeight: indicator.today ? '600' : '400' }]}>{indicator.label}</Text>
                </View>
              ) : indicator.type === 'repeat' ? (
                <Ionicons name="repeat" size={15} color={c.muted} accessibilityLabel={t('repeat.repeats')} />
              ) : (
                <Text style={[styles.meta, { color: c.muted }]}>{indicator.label}</Text>
              )}
            </View>
          )}
        </View>
        {indicator?.type === 'text' && (
          <Text style={{ color: c.muted, fontSize: 14 }} numberOfLines={1}>
            <Marked text={indicator.label} words={words} c={c} />
          </Text>
        )}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderRadius: 12,
  },
  iconBox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  time: { minWidth: 48, borderRadius: 8, paddingVertical: 3, paddingHorizontal: 4, alignItems: 'center' },
  timeText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  main: { flex: 1, gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 16 },
  struck: { textDecorationLine: 'line-through' },
  indicator: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  meta: { fontSize: 13 },
})

/** The text with the search words marked (nested Text keeps the line wrapping). */
function Marked({ text, words, c }: { text: string; words: string[]; c: Colors }) {
  if (!words.length) return <>{text}</>
  return <>{highlight(text, words).map((p, i) => (p.hit ? <Text key={i} style={{ backgroundColor: c.accentSoft, color: c.text }}>{p.text}</Text> : p.text))}</>
}
