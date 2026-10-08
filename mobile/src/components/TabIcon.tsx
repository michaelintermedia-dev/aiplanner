import Ionicons from '@expo/vector-icons/Ionicons'
import { useEffect, useState, type ComponentProps } from 'react'
import { Animated, StyleSheet, type ColorValue } from 'react-native'
import { useReduceMotion } from '@/lib/useReduceMotion'
import { useColors } from '@/theme'

type IconName = ComponentProps<typeof Ionicons>['name']

/**
 * A bottom filter tab's icon. The selected one stands out (Material-style): a
 * pill in the skin's soft accent behind the filled icon, popping in when it's
 * chosen. Same as the web's tab bar.
 */
export function TabIcon({ focused, icon, activeIcon, color }: { focused: boolean; icon: IconName; activeIcon: IconName; color: ColorValue }) {
  const c = useColors()
  const reduceMotion = useReduceMotion()
  const [pop] = useState(() => new Animated.Value(focused ? 1 : 0))
  useEffect(() => {
    Animated.timing(pop, { toValue: focused ? 1 : 0, duration: reduceMotion ? 0 : 200, useNativeDriver: true }).start()
  }, [focused, pop, reduceMotion])
  return (
    <Animated.View
      style={[
        styles.pill,
        focused && { backgroundColor: c.accentSoft },
        { transform: [{ scaleX: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] },
      ]}>
      <Ionicons name={focused ? activeIcon : icon} size={22} color={color} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  pill: { width: 58, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
})
