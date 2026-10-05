import { useNow } from '@/lib/useNow'
import { formatDateKey, formatDue, formatTime } from '@shared/dates'
import { useQuery } from '@tanstack/react-query'
import { StyleSheet, Text, View } from 'react-native'
import { todayApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { AppointmentRow } from '@/components/AppointmentRow'
import { DOCK_SPACE } from '@/components/CaptureDock'
import { Screen } from '@/components/Screen'
import { TaskRow } from '@/components/TaskRow'
import { Row, Section } from '@/components/ui'
import { useColors } from '@/theme'
import { t } from '@shared/i18n'


export default function TodayScreen() {
  const c = useColors()
  const { user, zone } = useAuth()
  const now = useNow()
  const { data, isPending, error } = useQuery({ queryKey: ['today'], queryFn: todayApi.get })

  return (
    <Screen bottomSpace={DOCK_SPACE}>
      <View>
        <Text style={{ color: c.muted }}>{t('today.hello', { name: user?.displayName ?? '' })}</Text>
        <Text style={[styles.date, { color: c.text }]}>
          {data ? formatDateKey(data.date, zone.locale) : t('date.today')}
        </Text>
        <Text style={[styles.clock, { color: c.muted }]}>{formatTime(now.toISOString(), zone)}</Text>
      </View>

      {isPending && <Text style={{ color: c.muted }}>{t('common.loading')}</Text>}
      {error && <Text style={{ color: c.danger }}>{error.message}</Text>}
      {data && (
        <>
          <Section title={t('today.schedule')} empty={t('today.scheduleEmpty')}>
            {data.appointmentsToday.map((a, i, all) => (
              <AppointmentRow key={a.id} appointment={a} last={i === all.length - 1} />
            ))}
          </Section>
          {data.overdueTasks.length > 0 && (
            <Section title={t('filter.when.overdue')} tone="warn">
              {data.overdueTasks.map((t, i, all) => (
                <TaskRow key={t.id} task={t} last={i === all.length - 1} />
              ))}
            </Section>
          )}
          <Section title={t('today.dueToday')} empty={t('today.dueTodayEmpty')}>
            {data.tasksDueToday.map((t, i, all) => (
              <TaskRow key={t.id} task={t} last={i === all.length - 1} />
            ))}
          </Section>
          <Section title={t('today.ongoing')} empty={t('today.ongoingEmpty')}>
            {data.ongoingTasks.map((t, i, all) => (
              <TaskRow key={t.id} task={t} last={i === all.length - 1} />
            ))}
          </Section>
          {data.upcomingReminders.length > 0 && (
            <Section title={t('today.upcomingReminders')}>
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
    </Screen>
  )
}

const styles = StyleSheet.create({
  date: { fontSize: 26, fontWeight: '700', marginTop: 2 },
  clock: { fontSize: 18, fontVariant: ['tabular-nums'] },
})
