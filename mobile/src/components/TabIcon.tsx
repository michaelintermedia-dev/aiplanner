import Ionicons from '@expo/vector-icons/Ionicons'
import { useEffect, useState, type ComponentProps } from 'react'
import { Animated, StyleSheet, View, type ColorValue } from 'react-native'
import { useReduceMotion } from '@/lib/useReduceMotion'
import { useColors } from '@/theme'

type IconName = ComponentProps<typeof Ionicons>['name']

/**
 * A bottom filter tab's icon. The selected one stands out (Material-style): a
 * pill in the skin's soft accent behind the filled icon, growing in when it's
 * chosen. Only the pill animates - the icon itself is never scaled. Same as
 * the web's tab bar.
 */
export function TabIcon({ focused, icon, activeIcon, color }: { focused: boolean; icon: IconName; activeIcon: IconName; color: ColorValue }) {
  const c = useColors()
  const reduceMotion = useReduceMotion()
  const [shown] = useState(() => new Animated.Value(focused ? 1 : 0))
  useEffect(() => {
    Animated.timing(shown, { toValue: focused ? 1 : 0, duration: reduceMotion ? 0 : 200, useNativeDriver: true }).start()
  }, [focused, shown, reduceMotion])
  return (
    <View style={styles.box}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.pill,
          { backgroundColor: c.accentSoft, opacity: shown, transform: [{ scaleX: shown.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] },
        ]}
      />
      <Ionicons name={focused ? activeIcon : icon} size={22} color={color} />
    </View>
  )
}

const styles = StyleSheet.create({
  box: { width: 58, height: 30, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: 15 },
})
