import { addDays, dateKey, formatDateKey, formatTime, todayKey } from '@shared/dates'
import type { CalendarItem } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { calendarApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { Screen } from '@/components/Screen'
import { Button, Row } from '@/components/ui'
import { useColors } from '@/theme'

/** Monday of the week containing `key` (weeks start on Monday, matching the API). */
function weekStart(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
  return addDays(key, -weekday)
}

/** Week agenda: one block per day, which reads better on a phone than a grid. */
export default function CalendarScreen() {
  const c = useColors()
  const { zone } = useAuth()
  const today = todayKey(zone.timeZone)
  const [anchor, setAnchor] = useState(today)
  const monday = weekStart(anchor)
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

  const { data, error } = useQuery({
    queryKey: ['calendar', 'week', monday],
    queryFn: () => calendarApi.get('week', monday),
  })

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>()
    for (const item of data?.items ?? []) {
      const key = dateKey(item.startUtc, zone.timeZone)
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return map
  }, [data, zone.timeZone])

  const range = `${formatDateKey(days[0], zone.locale, { month: 'short', day: 'numeric' })} – ${formatDateKey(days[6], zone.locale, { month: 'short', day: 'numeric' })}`

  return (
    <Screen>
      <View style={styles.toolbar}>
        <Text style={[styles.range, { color: c.text }]}>{range}</Text>
        <View style={styles.nav}>
          <Button title="‹" onPress={() => setAnchor(addDays(monday, -7))} accessibilityLabel="Previous week" />
          <Button title="Today" onPress={() => setAnchor(today)} />
          <Button title="›" onPress={() => setAnchor(addDays(monday, 7))} accessibilityLabel="Next week" />
        </View>
      </View>
      {error && <Text style={{ color: c.danger }}>{error.message}</Text>}

      {days.map((day) => {
        const items = itemsByDay.get(day) ?? []
        return (
          <View key={day} style={styles.day}>
            <Text style={[styles.dayTitle, { color: day === today ? c.accent : c.muted }]}>
              {formatDateKey(day, zone.locale, { weekday: 'long', day: 'numeric', month: 'short' })}
              {day === today ? ' · Today' : ''}
            </Text>
            {items.length > 0 ? (
              <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.border }]}>
                {items.map((item, i) => (
                  <Pressable
                    key={item.id}
                    onPress={() => router.push({ pathname: item.itemType === 'Task' ? '/task/[id]' : '/appointment/[id]', params: { id: item.id } })}
                    accessibilityRole="button">
                    <Row last={i === items.length - 1}>
                      <View style={[styles.bar, { backgroundColor: item.itemType === 'Appointment' ? c.appointment : c.task }]} />
                      <Text style={[styles.time, { color: c.muted }]}>{item.hasTime ? formatTime(item.startUtc, zone) : 'All day'}</Text>
                      <Text
                        style={[
                          styles.title,
                          { color: item.status === 'Completed' || item.status === 'Cancelled' ? c.muted : c.text },
                          (item.status === 'Completed' || item.status === 'Cancelled') && styles.struck,
                        ]}
                        numberOfLines={1}>
                        {item.title}
                      </Text>
                    </Row>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={{ color: c.muted, fontSize: 14 }}>Nothing planned</Text>
            )}
          </View>
        )
      })}

      {data && data.ongoingTasks.length > 0 && (
        <View style={styles.day}>
          <Text style={[styles.dayTitle, { color: c.muted }]}>ONGOING</Text>
          <View style={styles.chips}>
            {data.ongoingTasks.map((t) => (
              <Pressable key={t.id} style={[styles.chip, { backgroundColor: c.accentSoft }]}>
                <Text style={{ color: c.accent }}>{t.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  toolbar: { gap: 10 },
  range: { fontSize: 22, fontWeight: '700' },
  nav: { flexDirection: 'row', gap: 8 },
  day: { gap: 6 },
  dayTitle: { fontSize: 13, fontWeight: '600' },
  list: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: 'hidden' },
  bar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  time: { width: 64, fontVariant: ['tabular-nums'], fontSize: 14 },
  title: { flex: 1, fontSize: 16 },
  struck: { textDecorationLine: 'line-through' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
})
