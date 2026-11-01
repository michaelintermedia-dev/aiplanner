import Ionicons from '@expo/vector-icons/Ionicons'
import { router, Tabs } from 'expo-router'
import { Image, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '@/theme'
import { TabIcon } from '@/components/TabIcon'
import { t } from '@shared/i18n'

/** The bottom bar without the system inset (CaptureDock lifts the bubble above it). */
const TAB_BAR_HEIGHT = 66

/** The app icon (the Gatazee cat). */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- a bundled image
const CAT = require('../../../assets/images/icon.png')

/**
 * The bottom navigation (spec v2, 2026-10-31; same as the web): Feed · Today ·
 * Calendar. Settings is the gear in the header's top-right corner (user's call,
 * 2026-11-01). The feed's type chips (All / Tasks / Events / Notes) replaced the
 * old type tabs; item screens and Settings open on top with a back arrow.
 */
export default function TabLayout() {
  const c = useColors()
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        // The selected tab's label is bold too (with the pill behind its icon - TabIcon).
        // Room for the labels with the phone's text size turned up (they were cut off at the
        // bottom, 2026-11-01): a taller bar, and the labels grow at most 1.3x.
        tabBarLabel: ({ focused, color, children }) => (
          <Text
            maxFontSizeMultiplier={1.3}
            numberOfLines={1}
            style={{ color, fontSize: 12, lineHeight: 16, fontWeight: focused ? '700' : '400', marginTop: 2 }}>
            {children}
          </Text>
        ),
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, height: TAB_BAR_HEIGHT + insets.bottom, paddingTop: 6 },
        sceneStyle: { backgroundColor: 'transparent' },
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        headerShadowVisible: false,
        headerRight: () => (
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={8}
            style={{ paddingHorizontal: 14 }}
            accessibilityRole="button"
            accessibilityLabel={t('nav.settings')}>
            <Ionicons name="settings-outline" size={23} color={c.text} />
          </Pressable>
        ),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.feed'),
          // The cat next to the name, like the web's home header.
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Image source={CAT} style={{ width: 26, height: 26, borderRadius: 7 }} />
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>{t('app.name')}</Text>
            </View>
          ),
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} icon="albums-outline" activeIcon="albums" color={color} />,
        }}
      />
      <Tabs.Screen
        name="today"
        options={{ title: t('nav.today'), tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} icon="sunny-outline" activeIcon="sunny" color={color} /> }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ title: t('nav.calendar'), tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} icon="calendar-outline" activeIcon="calendar" color={color} /> }}
      />
    </Tabs>
  )
}
