import Ionicons from '@expo/vector-icons/Ionicons'
import { CALENDAR_VIEWS, periodTitle, stepPeriod, visibleDays } from '@shared/calendar'
import { dateKey, formatDateKey, formatTime, todayKey } from '@shared/dates'
import type { CalendarItem, CalendarView } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { calendarApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { KIND_ICON } from '@/components/kindIcons'
import { Screen } from '@/components/Screen'
import { Row } from '@/components/ui'
import { useColors, type Colors } from '@/theme'

const isClosed = (item: CalendarItem) => item.status === 'Completed' || item.status === 'Cancelled'

/**
 * Same controls as the web calendar (Day / Week / Month, ‹ Today ›, same
 * period title), laid out like a standard phone calendar: Month is a grid of
 * days with dots, Week a strip of days, and the selected day's items are
 * listed underneath in every view.
 */
export default function CalendarScreen() {
  const c = useColors()
  const { zone } = useAuth()
  const today = todayKey(zone.timeZone)
  const [view, setView] = useState<CalendarView>('month')
  const [selected, setSelected] = useState(today)
  const days = visibleDays(view, selected)

  const { data, error } = useQuery({
    queryKey: ['calendar', view, view === 'month' ? selected.slice(0, 7) : days[0]],
    queryFn: () => calendarApi.get(view, selected),
  })

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>()
    for (const item of data?.items ?? []) {
      const key = dateKey(item.startUtc, zone.timeZone)
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return map
  }, [data, zone.timeZone])

  const selectedItems = itemsByDay.get(selected) ?? []
  const move = (direction: 1 | -1) => {
    const next = stepPeriod(view, selected, direction)
    // Back in the current week/month? Select today rather than the 1st.
    const backToNow =
      view === 'month' ? next.slice(0, 7) === today.slice(0, 7) : view === 'week' && visibleDays('week', next).includes(today)
    setSelected(backToNow ? today : next)
  }

  return (
    <Screen>
      <View style={[styles.segmented, { borderColor: c.border }]}>
        {CALENDAR_VIEWS.map((v) => (
          <Pressable
            key={v.view}
            onPress={() => setView(v.view)}
            style={[styles.segment, view === v.view && { backgroundColor: c.accent }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === v.view }}>
            <Text style={{ color: view === v.view ? '#fff' : c.text, fontWeight: '600' }}>{v.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
          {periodTitle(view, selected, zone.locale)}
        </Text>
        <Pressable onPress={() => move(-1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Previous">
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <Pressable
          onPress={() => setSelected(today)}
          style={[styles.todayButton, { borderColor: c.border }]}
          accessibilityRole="button">
          <Text style={{ color: c.text }}>Today</Text>
        </Pressable>
        <Pressable onPress={() => move(1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Next">
          <Ionicons name="chevron-forward" size={24} color={c.text} />
        </Pressable>
      </View>
      {error && <Text style={{ color: c.danger }}>{error.message}</Text>}

      {view !== 'day' && (
        <View>
          <View style={styles.week}>
            {days.slice(0, 7).map((d) => (
              <Text key={d} style={[styles.weekday, { color: c.muted }]}>
                {formatDateKey(d, zone.locale, { weekday: 'narrow' })}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {days.map((d) => (
              <DayCell
                key={d}
                day={d}
                items={itemsByDay.get(d) ?? []}
                isToday={d === today}
                isSelected={d === selected}
                outside={view === 'month' && d.slice(0, 7) !== selected.slice(0, 7)}
                tall={view === 'week'}
                onPress={() => setSelected(d)}
                c={c}
              />
            ))}
          </View>
        </View>
      )}

      <View style={{ gap: 6 }}>
        <Text style={[styles.dayTitle, { color: selected === today ? c.accent : c.muted }]}>
          {formatDateKey(selected, zone.locale, { weekday: 'long', day: 'numeric', month: 'long' })}
          {selected === today ? ' · Today' : ''}
        </Text>
        {selectedItems.length > 0 ? (
          <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.border }]}>
            {selectedItems.map((item, i) => (
              <Pressable
                key={item.id}
                onPress={() => router.push({ pathname: item.itemType === 'Task' ? '/task/[id]' : '/appointment/[id]', params: { id: item.id } })}
                accessibilityRole="button">
                <Row last={i === selectedItems.length - 1}>
                  <Ionicons
                    name={item.itemType === 'Appointment' ? KIND_ICON.Appointment : item.status === 'Completed' ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={item.itemType === 'Appointment' ? c.appointment : c.task}
                  />
                  <Text style={[styles.time, { color: c.muted }]}>{item.hasTime ? formatTime(item.startUtc, zone) : 'All day'}</Text>
                  <Text
                    style={[styles.itemTitle, { color: isClosed(item) ? c.muted : c.text }, isClosed(item) && styles.struck]}
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

      {data && data.ongoingTasks.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text style={[styles.dayTitle, { color: c.muted }]}>ONGOING</Text>
          <View style={styles.chips}>
            {data.ongoingTasks.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => router.push({ pathname: '/task/[id]', params: { id: t.id } })}
                style={[styles.chip, { backgroundColor: c.accentSoft }]}>
                <Text style={{ color: c.accent }}>{t.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </Screen>
  )
}

function DayCell({
  day,
  items,
  isToday,
  isSelected,
  outside,
  tall,
  onPress,
  c,
}: {
  day: string
  items: CalendarItem[]
  isToday: boolean
  isSelected: boolean
  outside: boolean
  tall: boolean
  onPress: () => void
  c: Colors
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.cell, tall && styles.tallCell]}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${day}${items.length ? `, ${items.length} item${items.length > 1 ? 's' : ''}` : ''}`}>
      <View
        // Border always present (only its colour changes): toggling it on Android can drop the rounding.
        style={[
          styles.dayNumber,
          { backgroundColor: isSelected ? c.accent : 'transparent', borderColor: isToday && !isSelected ? c.accent : 'transparent' },
        ]}>
        <Text
          style={{
            color: isSelected ? '#fff' : isToday ? c.accent : outside ? c.muted : c.text,
            fontWeight: isToday || isSelected ? '700' : '400',
            opacity: outside && !isSelected ? 0.5 : 1,
          }}>
          {Number(day.slice(8))}
        </Text>
      </View>
      <View style={styles.dots}>
        {items.slice(0, 3).map((item) => (
          <View
            key={item.id}
            style={[
              styles.dot,
              { backgroundColor: item.itemType === 'Appointment' ? c.appointment : c.task },
              isClosed(item) && { opacity: 0.35 },
            ]}
          />
        ))}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 22, fontWeight: '700' },
  todayButton: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  week: { flexDirection: 'row' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '600', paddingBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 48, alignItems: 'center', paddingTop: 2 },
  tallCell: { height: 56 },
  dayNumber: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 3, marginTop: 3, height: 6 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dayTitle: { fontSize: 13, fontWeight: '600' },
  list: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: 'hidden' },
  time: { width: 64, fontVariant: ['tabular-nums'], fontSize: 14 },
  itemTitle: { flex: 1, fontSize: 16 },
  struck: { textDecorationLine: 'line-through' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
})
