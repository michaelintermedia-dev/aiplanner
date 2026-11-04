import { useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { useColors } from '@/theme'
import { DOCK_SPACE } from './CaptureDock'
import { InPanel } from './panel'

/**
 * Scrollable screen body with pull-to-refresh that refetches all data. The field being typed in
 * always scrolls above the keyboard (edge-to-edge Android doesn't resize the window, so the
 * keyboard covered the fields - 2026-11-05; KeyboardProvider in the root layout).
 */
/** Room at the end so the content can scroll clear of the floating new-entry toolbar. */
// `panel`: with a wallpaper the content sits on one frosted panel, so every line of it reads.
export function Screen({ children, bottomSpace = DOCK_SPACE, panel }: { children: ReactNode; bottomSpace?: number; panel?: boolean }) {
  const c = useColors()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const refresh = async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries()
    setRefreshing(false)
  }

  return (
    <KeyboardAwareScrollView
      bottomOffset={40}
      style={{ backgroundColor: c.page }}
      contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.muted} />}>
      {panel && c.panel ? (
        <InPanel.Provider value={true}>
          <View style={[styles.panel, c.panel]}>{children}</View>
        </InPanel.Provider>
      ) : (
        children
      )}
    </KeyboardAwareScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20, paddingBottom: 48 },
  panel: { gap: 20 },
})
