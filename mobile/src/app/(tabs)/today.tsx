import Ionicons from '@expo/vector-icons/Ionicons'
import { useNow } from '@/lib/useNow'
import { addDays, formatDateKey, formatDue, formatTime, todayKey } from '@shared/dates'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { todayApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { AppointmentRow } from '@/components/AppointmentRow'
import { DOCK_SPACE } from '@/components/CaptureDock'
import { Screen } from '@/components/Screen'
import { TaskRow } from '@/components/TaskRow'
import { Row, Section } from '@/components/ui'
import { useSwipeNav } from '@/lib/useSwipeNav'
import { useColors } from '@/theme'
import { t } from '@shared/i18n'
import type { Today } from '@shared/types'

/** Chevrons point the other way in right-to-left layouts. */
const flip = I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined

/**
 * Today - and, swiping sideways or with ‹ ›, any other day (user's request,
 * 2026-11-01; same as the web): that day's events and tasks due. Overdue and
 * ongoing are about now (today only); reminders: the next 7 days on today, the
 * ones going off that day on another day.
 */
export default function TodayScreen() {
  const c = useColors()
  const { user, zone } = useAuth()
  const now = useNow()
  const today = todayKey(zone.timeZone)
  // Days away from today, not a date: left open overnight it moves on to the new today
  // (it showed yesterday - bug fix 2026-11-02). useNow re-renders it every minute.
  const [offset, setOffset] = useState(0)
  const day = addDays(today, offset)
  const isToday = offset === 0
  const { data, isPending, error } = useQuery({ queryKey: ['today', day], queryFn: () => todayApi.get(isToday ? undefined : day) })
  const move = (direction: 1 | -1) => setOffset((o) => o + direction)
  const swipe = useSwipeNav(move)

  return (
    <Screen bottomSpace={DOCK_SPACE}>
      <View style={styles.head}>
        <View style={[{ flex: 1 }, c.block && { ...c.block, alignSelf: 'flex-start' }]}>
          {isToday && <Text style={{ color: c.muted }}>{t('today.hello', { name: user?.displayName ?? '' })}</Text>}
          {/* The weekday small above the date: one long line ("воскресенье, 8 ноября") wrapped (2026-11-08). */}
          <Text style={[styles.weekday, { color: isToday ? c.muted : c.accent }]}>{formatDateKey(day, zone.locale, { weekday: 'long' })}</Text>
          <Text style={[styles.date, { color: isToday ? c.text : c.accent }]}>{formatDateKey(day, zone.locale, { day: 'numeric', month: 'long' })}</Text>
          {isToday && <Text style={[styles.clock, { color: c.muted }]}>{formatTime(now.toISOString(), zone)}</Text>}
        </View>
        <View style={[styles.nav, c.pill]}>
          <Pressable onPress={() => move(-1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('calendar.previous')}>
            <Ionicons name="chevron-back" size={24} color={c.text} style={flip} />
          </Pressable>
          {!isToday && (
            <Pressable onPress={() => setOffset(0)} style={[styles.todayButton, { borderColor: c.border }]} accessibilityRole="button">
              <Text style={{ color: c.text }}>{t('date.today')}</Text>
            </Pressable>
          )}
          <Pressable onPress={() => move(1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('calendar.next')}>
            <Ionicons name="chevron-forward" size={24} color={c.text} style={flip} />
          </Pressable>
        </View>
      </View>

      <GestureDetector gesture={swipe.gestures[0]}>
        <Animated.View style={[styles.body, swipe.style]}>
          {isPending && <Text style={[{ color: c.muted }, c.pillStart]}>{t('common.loading')}</Text>}
          {error && <Text style={[{ color: c.danger }, c.pillStart]}>{error.message}</Text>}
          {data && (
            <>
              {/* Only sections with something in them; an empty day says so once (2026-11-02). */}
              {nothing(data, isToday) && <Text style={[{ color: c.muted, fontSize: 15 }, c.pillStart]}>{t('calendar.nothingPlanned')}</Text>}
              {data.appointmentsToday.length > 0 && (
                <Section title={t('today.schedule')}>
                  {data.appointmentsToday.map((a, i, all) => (
                    <AppointmentRow key={a.id} appointment={a} last={i === all.length - 1} />
                  ))}
                </Section>
              )}
              {data.overdueTasks.length > 0 && (
                <Section title={t('filter.when.overdue')} tone="warn">
                  {data.overdueTasks.map((t, i, all) => (
                    <TaskRow key={t.id} task={t} last={i === all.length - 1} />
                  ))}
                </Section>
              )}
              {data.tasksDueToday.length > 0 && (
                <Section title={isToday ? t('today.dueToday') : t('today.due')}>
                  {data.tasksDueToday.map((t, i, all) => (
                    <TaskRow key={t.id} task={t} last={i === all.length - 1} />
                  ))}
                </Section>
              )}
              {isToday && data.ongoingTasks.length > 0 && (
                <Section title={t('today.ongoing')}>
                  {data.ongoingTasks.map((t, i, all) => (
                    <TaskRow key={t.id} task={t} last={i === all.length - 1} />
                  ))}
                </Section>
              )}
              {data.upcomingReminders.length > 0 && (
                <Section title={isToday ? t('today.upcomingReminders') : t('today.remindersDay')}>
                  {data.upcomingReminders.map((r, i, all) => (
                    <Row key={r.key} last={i === all.length - 1}>
                      <Text style={{ color: c.text, flex: 1, fontSize: 16 }}>{r.title}</Text>
                      <Text style={{ color: c.muted, fontSize: 13 }}>{formatDue(r.triggerAtUtc, true, zone)}</Text>
                    </Row>
                  ))}
                </Section>
              )}
            </>
          )}
        </Animated.View>
      </GestureDetector>
    </Screen>
  )
}

/** A day with nothing on it at all. */
const nothing = (d: Today, isToday: boolean) =>
  d.appointmentsToday.length === 0 && d.tasksDueToday.length === 0 && d.overdueTasks.length === 0 &&
  (!isToday || d.ongoingTasks.length === 0) && d.upcomingReminders.length === 0

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  weekday: { fontSize: 15, fontWeight: '600', marginTop: 2, textTransform: 'capitalize' },
  date: { fontSize: 26, fontWeight: '700' },
  clock: { fontSize: 18, fontVariant: ['tabular-nums'] },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  todayButton: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  // Room to swipe even on an empty day.
  body: { gap: 20, minHeight: 400 },
})
