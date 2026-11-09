import Ionicons from '@expo/vector-icons/Ionicons'
import { t } from '@shared/i18n'
import { Pressable, StyleSheet } from 'react-native'
import { useColors } from '@/theme'

/**
 * Delete on an item's screen: a round button with an X, next to Edit and the mic (it was the
 * word "Delete", which didn't look like a button - user's call, 2026-11-09). Same as the web's.
 */
export function DeleteButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.button, { borderColor: c.danger, backgroundColor: c.surface, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={t('common.delete')}>
      <Ionicons name="close" size={24} color={c.danger} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
})
