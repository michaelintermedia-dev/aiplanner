import { useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useColors } from '@/theme'
import { DOCK_SPACE } from './CaptureDock'
import { InPanel } from './panel'

/** Scrollable screen body with pull-to-refresh that refetches all data. */
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
    <ScrollView
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
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20, paddingBottom: 48 },
  panel: { gap: 20 },
})
