import type { NotificationSettings } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import * as Notifications from '@/lib/expoNotifications'
import { useEffect, useState } from 'react'
import { Linking, StyleSheet, Switch, Text, View } from 'react-native'
import { settingsApi } from '@/api/endpoints'
import { DateTimeField } from '@/components/DateTimeField'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui'
import { useAction } from '@/lib/useAction'
import { useColors } from '@/theme'

/** Settings - Notifications (same as web's Settings page). Changes save immediately. */
export default function SettingsScreen() {
  const c = useColors()
  const { data: settings, error } = useQuery({ queryKey: ['settings', 'notifications'], queryFn: settingsApi.notifications })
  const save = useAction(settingsApi.updateNotifications)
  const [osAllowed, setOsAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    Notifications.getPermissionsAsync().then((p) => setOsAllowed(p.granted))
  }, [])

  if (error) return <Screen><Text style={{ color: c.danger }}>{error.message}</Text></Screen>
  if (!settings) return <Screen><Text style={{ color: c.muted }}>Loading…</Text></Screen>

  const change = (patch: Partial<NotificationSettings>) => save.mutate({ ...settings, ...patch })

  return (
    <Screen>
      <Text style={[styles.heading, { color: c.muted }]}>NOTIFICATIONS</Text>
      {osAllowed === false && (
        <View style={[styles.warning, { borderColor: c.warn }]}>
          <Text style={{ color: c.text }}>Notifications are blocked for this app on this phone.</Text>
          <Button title="Open phone settings" onPress={() => void Linking.openSettings()} />
        </View>
      )}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Row label="Notifications" hint="Master switch for all devices" value={settings.enabled} onChange={(enabled) => change({ enabled })} />
        <Row label="Task reminders" value={settings.taskReminders} onChange={(taskReminders) => change({ taskReminders })} disabled={!settings.enabled} />
        <Row
          label="Event reminders"
          value={settings.appointmentReminders}
          onChange={(appointmentReminders) => change({ appointmentReminders })}
          disabled={!settings.enabled}
        />
        <Row
          label="Daily summary"
          hint="What's due today, what's overdue, and today's events"
          value={settings.dailySummary}
          onChange={(dailySummary) => change({ dailySummary })}
          disabled={!settings.enabled}
        />
        {settings.enabled && settings.dailySummary && (
          <View style={[styles.row, { borderColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>Daily summary at</Text>
            <DateTimeField mode="time" value={settings.dailySummaryTime} onChange={(t) => t && change({ dailySummaryTime: t })} placeholder="Time" />
          </View>
        )}
      </View>
      {save.error && <Text style={{ color: c.danger }}>{save.error.message}</Text>}
    </Screen>
  )
}

function Row({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const c = useColors()
  return (
    <View style={[styles.row, { borderColor: c.border, opacity: disabled ? 0.5 : 1 }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 16 }}>{label}</Text>
        {hint && <Text style={{ color: c.muted, fontSize: 13 }}>{hint}</Text>}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: c.accent }} accessibilityLabel={label} />
    </View>
  )
}

const styles = StyleSheet.create({
  heading: { fontSize: 13, fontWeight: '600', letterSpacing: 0.6 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  warning: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
})
