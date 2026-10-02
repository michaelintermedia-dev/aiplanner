import { LANGUAGES, languageOf, t, type Language } from '@shared/i18n'
import type { NotificationSettings } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import * as Notifications from '@/lib/expoNotifications'
import { useEffect, useState } from 'react'
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { settingsApi } from '@/api/endpoints'
import { useAuth } from '@/auth/useAuth'
import { DateTimeField } from '@/components/DateTimeField'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui'
import { useAction } from '@/lib/useAction'
import { useColors } from '@/theme'

/** Settings - Language, Notifications (same as web's Settings page). Changes save immediately. */
export default function SettingsScreen() {
  const c = useColors()
  const { zone, changeLanguage } = useAuth()
  const [languageError, setLanguageError] = useState<string | null>(null)
  const { data: settings, error } = useQuery({ queryKey: ['settings', 'notifications'], queryFn: settingsApi.notifications })
  const save = useAction(settingsApi.updateNotifications)
  const [osAllowed, setOsAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    Notifications.getPermissionsAsync().then((p) => setOsAllowed(p.granted))
  }, [])

  if (error) return <Screen><Text style={{ color: c.danger }}>{error.message}</Text></Screen>
  if (!settings) return <Screen><Text style={{ color: c.muted }}>{t('common.loading')}</Text></Screen>

  const change = (patch: Partial<NotificationSettings>) => save.mutate({ ...settings, ...patch })

  return (
    <Screen>
      <Text style={[styles.heading, { color: c.muted }]}>{t('settings.language').toUpperCase()}</Text>
      <View style={styles.languages} accessibilityRole="radiogroup" accessibilityLabel={t('settings.language')}>
        {LANGUAGES.map((l) => {
          const on = languageOf(zone.locale) === l.code
          return (
            <Pressable
              key={l.code}
              onPress={() => {
                setLanguageError(null)
                changeLanguage(l.code as Language).catch((e: Error) => setLanguageError(e.message))
              }}
              style={[styles.language, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : c.surface }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}>
              <Text style={{ color: on ? c.accent : c.text, fontSize: 16 }}>{l.name}</Text>
            </Pressable>
          )
        })}
      </View>
      <Text style={{ color: c.muted, fontSize: 13 }}>{t('settings.languageHint')}</Text>
      {languageError && <Text style={{ color: c.danger }}>{languageError}</Text>}

      <Text style={[styles.heading, { color: c.muted }]}>{t('settings.notifications').toUpperCase()}</Text>
      {osAllowed === false && (
        <View style={[styles.warning, { borderColor: c.warn }]}>
          <Text style={{ color: c.text }}>{t('settings.phoneBlocked')}</Text>
          <Button title={t('settings.openPhoneSettings')} onPress={() => void Linking.openSettings()} />
        </View>
      )}
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Row label={t('settings.notifications')} hint={t('settings.notificationsHint')} value={settings.enabled} onChange={(enabled) => change({ enabled })} />
        <Row label={t('settings.taskReminders')} value={settings.taskReminders} onChange={(taskReminders) => change({ taskReminders })} disabled={!settings.enabled} />
        <Row
          label={t('settings.eventReminders')}
          value={settings.appointmentReminders}
          onChange={(appointmentReminders) => change({ appointmentReminders })}
          disabled={!settings.enabled}
        />
        <Row
          label={t('settings.dailySummary')}
          hint={t('settings.dailySummaryHint')}
          value={settings.dailySummary}
          onChange={(dailySummary) => change({ dailySummary })}
          disabled={!settings.enabled}
        />
        {settings.enabled && settings.dailySummary && (
          <View style={[styles.row, { borderColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>{t('settings.dailySummaryAt')}</Text>
            <DateTimeField mode="time" value={settings.dailySummaryTime} onChange={(time) => time && change({ dailySummaryTime: time })} placeholder={t('item.time')} />
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
  languages: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  language: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, minHeight: 40, justifyContent: 'center' },
})
