import Ionicons from '@expo/vector-icons/Ionicons'
import { formatTime } from '@shared/dates'
import { t } from '@shared/i18n'
import { searchZones, timeZoneChoices, zoneLabel } from '@shared/timeZones'
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useAuth } from '@/auth/useAuth'
import { useColors } from '@/theme'
import { Button } from './ui'

const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone

/**
 * Settings - Time zone (same as the web): the account's zone with the time
 * there now, "Use this device's" when the phone is somewhere else (travel),
 * and a search for any other city.
 */
export function TimeZoneSetting() {
  const c = useColors()
  const { zone, changeTimeZone } = useAuth()
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const zones = useMemo(() => timeZoneChoices(zone.timeZone), [zone.timeZone])
  const results = searchZones(zones, query)

  const choose = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      await changeTimeZone(id)
      setQuery('')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: c.text, fontSize: 16 }}>
        <Text style={{ fontWeight: '600' }}>{zoneLabel(zone.timeZone)}</Text>
        <Text style={{ color: c.muted }}> · {t('settings.timeZoneNow', { time: formatTime(new Date().toISOString(), zone) })}</Text>
      </Text>
      {!!deviceZone && deviceZone !== zone.timeZone && (
        <Button title={t('settings.timeZoneDevice', { zone: zoneLabel(deviceZone) })} variant="primary" busy={busy} onPress={() => void choose(deviceZone)} />
      )}
      <View style={[styles.search, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Ionicons name="search" size={16} color={c.muted} />
        <TextInput
          style={[styles.input, { color: c.text }]}
          value={query}
          onChangeText={setQuery}
          placeholder={t('settings.timeZoneSearch')}
          placeholderTextColor={c.muted}
          accessibilityLabel={t('settings.timeZoneSearch')}
        />
      </View>
      {results.length > 0 && (
        <View style={styles.results}>
          {results.map((id) => (
            <Pressable
              key={id}
              disabled={busy}
              onPress={() => void choose(id)}
              style={[styles.result, { borderColor: c.border }]}
              accessibilityRole="button">
              <Text style={{ color: c.text }}>{zoneLabel(id)}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Text style={{ color: c.muted, fontSize: 13 }}>{t('settings.timeZoneHint')}</Text>
      {error && <Text style={{ color: c.danger }}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14 },
  input: { flex: 1, minHeight: 42, fontSize: 15 },
  results: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  result: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 36, justifyContent: 'center' },
})
