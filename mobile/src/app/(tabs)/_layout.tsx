import Ionicons from '@expo/vector-icons/Ionicons'
import { router, Tabs } from 'expo-router'
import { Alert, Pressable, Text, View } from 'react-native'
import { useAuth } from '@/auth/useAuth'
import { useColors } from '@/theme'
import { TabIcon } from '@/components/TabIcon'
import { KIND_ICON } from '@/components/kindIcons'
import { t } from '@shared/i18n'

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
    Alert.alert(user?.displayName ?? t('nav.account'), user?.email, [
      { text: t('nav.settings'), onPress: () => router.push('/settings') },
      { text: t('auth.signOut'), style: 'destructive', onPress: () => void logout() },
      { text: t('common.close'), style: 'cancel' },
    ])

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        // The selected filter's label is bold too (with the pill behind its icon - TabIcon).
        tabBarLabel: ({ focused, color, children }) => (
          <Text style={{ color, fontSize: 12, fontWeight: focused ? '700' : '400', marginTop: 2 }}>{children}</Text>
        ),
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        sceneStyle: { backgroundColor: 'transparent' },
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        headerShadowVisible: false,
        headerRight: () => (
          <View style={{ flexDirection: 'row', paddingEnd: 6 }}>
            <HeaderButton icon="sunny-outline" label={t('nav.today')} onPress={() => router.push('/today')} />
            <HeaderButton icon="calendar-outline" label={t('nav.calendar')} onPress={() => router.push('/calendar')} />
            <HeaderButton icon="person-circle-outline" label={t('nav.account')} onPress={account} />
          </View>
        ),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('feed.tab.all'),
          headerTitle: t('app.name'),
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} icon="albums-outline" activeIcon="albums" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{ title: t('feed.tab.tasks'), tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} icon={KIND_ICON.Task} activeIcon="checkbox" color={color} /> }}
      />
      <Tabs.Screen
        name="events"
        options={{ title: t('feed.tab.events'), tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} icon={KIND_ICON.Appointment} activeIcon="time" color={color} /> }}
      />
      <Tabs.Screen
        name="notes"
        options={{ title: t('feed.tab.notes'), tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} icon={KIND_ICON.Note} activeIcon="document-text" color={color} /> }}
      />
    </Tabs>
  )
}
