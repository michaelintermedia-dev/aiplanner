import Ionicons from '@expo/vector-icons/Ionicons'
import { router, Tabs } from 'expo-router'
import { Alert, Pressable, View } from 'react-native'
import { useAuth } from '@/auth/useAuth'
import { useColors } from '@/theme'
import { KIND_ICON } from '@/components/kindIcons'

/**
 * The bottom bar filters one feed: All / Tasks / Events / Notes. Today and
 * Calendar (date-based views) open from the header icons.
 */
export default function TabLayout() {
  const { user, logout } = useAuth()
  const c = useColors()

  const HeaderButton = ({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) => (
    <Pressable onPress={onPress} hitSlop={8} style={{ paddingHorizontal: 10 }} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={23} color={c.text} />
    </Pressable>
  )

  const account = () =>
    Alert.alert(user?.displayName ?? 'Account', user?.email, [
      { text: 'Settings', onPress: () => router.push('/settings') },
      { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
      { text: 'Close', style: 'cancel' },
    ])

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        headerShadowVisible: false,
        headerRight: () => (
          <View style={{ flexDirection: 'row', paddingRight: 6 }}>
            <HeaderButton icon="sunny-outline" label="Today" onPress={() => router.push('/today')} />
            <HeaderButton icon="calendar-outline" label="Calendar" onPress={() => router.push('/calendar')} />
            <HeaderButton icon="person-circle-outline" label="Account" onPress={account} />
          </View>
        ),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'All',
          headerTitle: 'AI Planner',
          tabBarIcon: ({ color, size }) => <Ionicons name="albums-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{ title: 'Tasks', tabBarIcon: ({ color, size }) => <Ionicons name={KIND_ICON.Task} color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="events"
        options={{ title: 'Events', tabBarIcon: ({ color, size }) => <Ionicons name={KIND_ICON.Appointment} color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="notes"
        options={{ title: 'Notes', tabBarIcon: ({ color, size }) => <Ionicons name={KIND_ICON.Note} color={color} size={size} /> }}
      />
    </Tabs>
  )
}
