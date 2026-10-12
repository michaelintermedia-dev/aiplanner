import Ionicons from '@expo/vector-icons/Ionicons'
import { t } from '@shared/i18n'
import { placeFromPosition } from '@shared/links'
import * as Location from 'expo-location'
import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useColors } from '@/theme'

/**
 * The place of an item, typed or "Use my location" (user's request,
 * 2026-10-12): the phone's position, turned into a street address when the
 * phone can (else the coordinates - Google Maps and Waze open those exactly).
 * Same as the web's PlaceField.
 */
export function PlaceField({ value, onChange, changed }: { value: string; onChange: (place: string) => void; changed: boolean }) {
  const c = useColors()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locate = async () => {
    setBusy(true)
    setError(null)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setError(t('place.noPermission'))
        return
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      const { latitude, longitude } = pos.coords
      let place = placeFromPosition(latitude, longitude)
      try {
        const [a] = await Location.reverseGeocodeAsync({ latitude, longitude })
        const street = a && [a.street, a.streetNumber].filter(Boolean).join(' ')
        const text = a && [street || a.name, a.city ?? a.subregion].filter(Boolean).join(', ')
        if (text) place = text
      } catch {
        // no address - the coordinates will do
      }
      onChange(place)
    } catch {
      setError(t('place.unavailable'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: changed ? c.accent : c.muted, fontSize: 13 }}>{t('event.location')}</Text>
      <View style={styles.row}>
        <TextInput
          value={value}
          onChangeText={onChange}
          style={[styles.input, { color: c.text, borderColor: changed ? c.accent : c.border, backgroundColor: c.surface }]}
          placeholderTextColor={c.muted}
        />
        <Pressable
          onPress={() => void locate()}
          disabled={busy}
          style={({ pressed }) => [styles.button, { borderColor: c.border, backgroundColor: c.surface, opacity: pressed ? 0.7 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={t('place.useMyLocation')}>
          {busy ? <ActivityIndicator color={c.accent} /> : <Ionicons name="locate-outline" size={22} color={c.accent} />}
        </Pressable>
      </View>
      {error && <Text style={{ color: c.danger, fontSize: 13 }}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 46, fontSize: 16 },
  button: { width: 46, height: 46, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
})
